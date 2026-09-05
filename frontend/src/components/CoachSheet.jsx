import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { SPRING_SNAPPY } from "../lib/motion.jsx";
import Sheet from "./Sheet.jsx";

function Bubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
          isUser ? "bg-ink text-white" : "glass-tint text-ink"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export default function CoachSheet({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoadingHistory(true);
    api.ai
      .coachHistory()
      .then((d) => setMessages(d.messages || []))
      .finally(() => setLoadingHistory(false));
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: text }]);
    setLoading(true);
    try {
      const { reply } = await api.ai.coach(text);
      setMessages((prev) => [...prev, { id: `local-${Date.now()}-r`, role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-e`, role: "assistant", content: "Sorry, something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="AI Coach">
      <div className="flex h-[60vh] flex-col gap-3">
        <div className="flex-1 overflow-y-auto pr-1">
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-ink/40" />
            </div>
          ) : messages.length === 0 ? (
            <div className="glass-tint flex flex-col items-center gap-2 rounded-2xl px-6 py-8 text-center">
              <Sparkles size={22} className="text-acc-violet" />
              <p className="text-[13px] font-semibold text-ink/70">Ask your coach anything</p>
              <p className="text-[12px] text-ink/40">
                "How am I doing this week?" · "What should I eat tonight?" · "Suggest a leg day"
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 pb-2">
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} content={m.content} />
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="glass-tint flex items-center gap-1.5 rounded-2xl px-4 py-2.5">
                    <Loader2 size={14} className="animate-spin text-ink/40" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach..."
            className="glass min-w-0 flex-1 rounded-full px-4 py-3 text-[14px] text-ink placeholder:text-ink/30 focus:outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={SPRING_SNAPPY}
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"
          >
            <Send size={17} />
          </motion.button>
        </form>
      </div>
    </Sheet>
  );
}
