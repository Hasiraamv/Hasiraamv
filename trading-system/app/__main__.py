"""CLI entry point.

    python -m app data ingest --symbol BTC/USDT --timeframe 1h --since 2024-01-01
    python -m app backtest --strategy baseline_rsi_macd --pair BTC/USDT --from 2024-01-01
    python -m app paper --config paper.yaml
    python -m app agent --task "daily report"
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime

from app.monitoring.logging_config import configure_logging, get_logger

logger = get_logger("app.cli")


def _date_to_ms(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=UTC)
    return int(dt.timestamp() * 1000)


def cmd_data_ingest(args: argparse.Namespace) -> None:
    from app.data.ingest import CCXTIngestor

    ingestor = CCXTIngestor()
    since_ms = _date_to_ms(args.since)

    if args.kind == "ohlcv":
        written = ingestor.backfill_ohlcv(args.symbol, args.timeframe, since_ms)
        print(json.dumps({"symbol": args.symbol, "timeframe": args.timeframe, "kind": "ohlcv", "rows_written": written}))
    elif args.kind == "trades":
        written = ingestor.backfill_trades(args.symbol, since_ms)
        print(json.dumps({"symbol": args.symbol, "kind": "trades", "rows_written": written}))
    elif args.kind == "funding":
        written = ingestor.backfill_funding(args.symbol, since_ms)
        print(json.dumps({"symbol": args.symbol, "kind": "funding", "rows_written": written}))


def cmd_data_stream(args: argparse.Namespace) -> None:
    import asyncio

    from app.data.ingest import CCXTIngestor

    ingestor = CCXTIngestor()
    print(f"Streaming OHLCV+trades (WS) and funding/OI (REST poll) for {args.symbols or ingestor.settings.symbols}. Ctrl-C to stop.")
    try:
        asyncio.run(ingestor.run_universe(symbols=args.symbols, timeframe=args.timeframe))
    except KeyboardInterrupt:
        pass


def _merge_funding_into_bars(bars: list, funding_df) -> None:
    """Best-effort as-of merge of previously-ingested funding rates onto bars,
    forward-filling the most recent known rate at or before each bar's
    timestamp. No-op if no funding data has been ingested for this pair."""
    if funding_df is None or (hasattr(funding_df, "is_empty") and funding_df.is_empty()) or len(funding_df) == 0:
        return

    import polars as pl

    bars_df = pl.DataFrame({"ts": [b.ts for b in bars]}).sort("ts")
    funding_sorted = funding_df.select(["ts", "funding_rate"]).sort("ts")
    merged = bars_df.join_asof(funding_sorted, on="ts", strategy="backward")
    for bar, rate in zip(bars, merged["funding_rate"].fill_null(0.0).to_list()):
        bar.funding_rate = float(rate or 0.0)


def cmd_backtest(args: argparse.Namespace) -> None:
    from app.backtest.engine import BacktestEngine, Bar
    from app.config import get_settings
    from app.data.storage import ParquetStore
    from app.signals.baseline import BaselineSignalGenerator
    from app.signals.lgbm_strategy import LGBMWalkForwardSignalGenerator

    settings = get_settings()
    store = ParquetStore(settings.parquet_dir)
    df = store.read_ohlcv(settings.exchange_id, args.pair, args.timeframe)
    if df.is_empty() if hasattr(df, "is_empty") else len(df) == 0:
        print(
            f"No cached OHLCV for {args.pair}. Run `python -m app data ingest --symbol {args.pair} "
            f"--kind ohlcv --timeframe {args.timeframe} --since {args.__dict__['from']}` first.",
            file=sys.stderr,
        )
        sys.exit(1)

    rows = df.to_dicts()
    bars = [
        Bar(symbol=args.pair, ts=r["ts"], open=r["open"], high=r["high"], low=r["low"], close=r["close"], volume=r["volume"])
        for r in rows
    ]
    _merge_funding_into_bars(bars, store.read_funding(settings.exchange_id, args.pair))

    strategies = {
        "baseline_rsi_macd": BaselineSignalGenerator(),
        "lightgbm_walkforward": LGBMWalkForwardSignalGenerator(),
    }
    if args.strategy not in strategies:
        print(f"Unknown strategy {args.strategy!r}. Choices: {list(strategies)}", file=sys.stderr)
        sys.exit(1)
    strategy = strategies[args.strategy]

    engine = BacktestEngine()
    result = engine.run({args.pair: bars}, strategy)
    print(
        json.dumps(
            {
                "accepted_orders": result.accepted_orders,
                "rejected_orders": result.rejected_orders,
                "final_equity": result.equity_curve[-1] if result.equity_curve else None,
                "metrics": vars(result.metrics),
            },
            default=str,
            indent=2,
        )
    )


def cmd_paper(args: argparse.Namespace) -> None:
    import asyncio

    import yaml

    from app.config import get_settings
    from app.paper.scheduler import PaperTradingLoop
    from app.signals.baseline import BaselineSignalGenerator

    config = {}
    if args.config:
        with open(args.config) as fh:
            config = yaml.safe_load(fh) or {}

    settings = get_settings()
    symbols = config.get("symbols", settings.symbols)
    loop = PaperTradingLoop(symbols=symbols, strategy=BaselineSignalGenerator())
    print(f"Starting paper trading loop for {symbols}. PAPER TRADING ONLY. Ctrl-C to stop.")
    try:
        asyncio.run(loop.run_forever())
    except KeyboardInterrupt:
        loop.stop()


def cmd_agent(args: argparse.Namespace) -> None:
    from app.agent.graph import run_daily_report

    result = run_daily_report(task=args.task)
    print(result.get("report", ""))
    pending = result.get("pending_approvals", [])
    if pending:
        print(f"\n{len(pending)} proposal(s) awaiting human approval:", file=sys.stderr)
        print(json.dumps(pending, indent=2, default=str), file=sys.stderr)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="app", description="Crypto research/backtest/paper-trading system")
    sub = parser.add_subparsers(dest="command", required=True)

    data_parser = sub.add_parser("data", help="Data operations")
    data_sub = data_parser.add_subparsers(dest="data_command", required=True)
    ingest_parser = data_sub.add_parser("ingest", help="Backfill OHLCV/trades/funding via CCXT REST")
    ingest_parser.add_argument("--symbol", required=True)
    ingest_parser.add_argument("--kind", choices=["ohlcv", "trades", "funding"], default="ohlcv")
    ingest_parser.add_argument("--timeframe", default="1h", help="Only used for --kind ohlcv")
    ingest_parser.add_argument("--since", required=True, help="YYYY-MM-DD")
    ingest_parser.set_defaults(func=cmd_data_ingest)

    stream_parser = data_sub.add_parser("stream", help="Run WS streaming + funding/OI polling for the symbol universe")
    stream_parser.add_argument("--symbols", nargs="*", default=None, help="Defaults to settings.symbols")
    stream_parser.add_argument("--timeframe", default="1h")
    stream_parser.set_defaults(func=cmd_data_stream)

    backtest_parser = sub.add_parser("backtest", help="Run an event-driven backtest (fees, slippage, funding)")
    backtest_parser.add_argument(
        "--strategy", choices=["baseline_rsi_macd", "lightgbm_walkforward"], default="baseline_rsi_macd"
    )
    backtest_parser.add_argument("--pair", required=True)
    backtest_parser.add_argument("--timeframe", default="1h")
    backtest_parser.add_argument("--from", dest="from", required=True, help="YYYY-MM-DD")
    backtest_parser.set_defaults(func=cmd_backtest)

    paper_parser = sub.add_parser("paper", help="Run the paper trading scheduler loop")
    paper_parser.add_argument("--config", default=None, help="Path to paper.yaml")
    paper_parser.set_defaults(func=cmd_paper)

    agent_parser = sub.add_parser("agent", help="Run the LangGraph agent (advisory only)")
    agent_parser.add_argument("--task", default="Produce the daily trading report.")
    agent_parser.set_defaults(func=cmd_agent)

    return parser


def main() -> None:
    from app.config import get_settings

    configure_logging(get_settings().log_level)
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
