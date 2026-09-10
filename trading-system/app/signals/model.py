"""Walk-forward LightGBM classifier/regressor. LightGBM/scikit-learn/MLflow
are imported lazily so the rest of the system (risk, backtest, api) never
needs the ML extras installed — install with `pip install -e .[ml]`.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class WalkForwardResult:
    fold_metrics: list[dict[str, float]]
    model: Any
    mlflow_run_id: str | None = None


class WalkForwardLGBM:
    """Trains a LightGBM classifier (direction) and regressor (magnitude) with
    expanding-window walk-forward splits, logging params/metrics/artifacts to
    MLflow when available."""

    def __init__(self, n_splits: int = 5, params: dict[str, Any] | None = None):
        self.n_splits = n_splits
        self.params = params or {"n_estimators": 200, "max_depth": 5, "learning_rate": 0.05}

    def _splits(self, n: int):
        fold_size = n // (self.n_splits + 1)
        for i in range(1, self.n_splits + 1):
            train_end = fold_size * i
            test_end = min(fold_size * (i + 1), n)
            if train_end >= test_end:
                continue
            yield list(range(train_end)), list(range(train_end, test_end))

    def train_classifier(self, X: list[list[float]], y_direction: list[int], experiment: str = "signals") -> WalkForwardResult:
        import lightgbm as lgb
        from sklearn.metrics import accuracy_score, f1_score

        fold_metrics: list[dict[str, float]] = []
        model = None
        run_id = None

        mlflow = self._maybe_mlflow()
        ctx = mlflow.start_run(run_name=f"{experiment}_classifier") if mlflow else _nullcontext()

        with ctx as run:
            if mlflow and run is not None:
                run_id = run.info.run_id
                mlflow.log_params(self.params)

            for train_idx, test_idx in self._splits(len(X)):
                X_train = [X[i] for i in train_idx]
                y_train = [y_direction[i] for i in train_idx]
                X_test = [X[i] for i in test_idx]
                y_test = [y_direction[i] for i in test_idx]

                model = lgb.LGBMClassifier(**self.params)
                model.fit(X_train, y_train)
                preds = model.predict(X_test)

                metrics = {
                    "accuracy": float(accuracy_score(y_test, preds)),
                    "f1": float(f1_score(y_test, preds, average="macro", zero_division=0)),
                    "n_test": len(y_test),
                }
                fold_metrics.append(metrics)
                if mlflow:
                    mlflow.log_metrics(metrics, step=len(fold_metrics))

        return WalkForwardResult(fold_metrics=fold_metrics, model=model, mlflow_run_id=run_id)

    def train_regressor(self, X: list[list[float]], y_return: list[float], experiment: str = "signals") -> WalkForwardResult:
        import lightgbm as lgb
        from sklearn.metrics import mean_absolute_error

        fold_metrics: list[dict[str, float]] = []
        model = None

        for train_idx, test_idx in self._splits(len(X)):
            X_train = [X[i] for i in train_idx]
            y_train = [y_return[i] for i in train_idx]
            X_test = [X[i] for i in test_idx]
            y_test = [y_return[i] for i in test_idx]

            model = lgb.LGBMRegressor(**self.params)
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            fold_metrics.append({"mae": float(mean_absolute_error(y_test, preds)), "n_test": len(y_test)})

        return WalkForwardResult(fold_metrics=fold_metrics, model=model)

    @staticmethod
    def _maybe_mlflow():
        try:
            import mlflow

            return mlflow
        except ImportError:
            return None


class _nullcontext:
    def __enter__(self):
        return None

    def __exit__(self, *exc):
        return False
