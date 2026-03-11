/**
 * WinnyChatbot.tsx
 *
 * Winny — Oasis Pure Cleaning CC's AI-powered assistant.
 * Uses Claude Haiku via the winny-chat edge function for natural, intelligent responses.
 * Falls back gracefully to local FAQ matching if the AI is unavailable.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Send, Sparkles } from "lucide-react";
import { getSetting, SETTINGS_KEYS } from "@/lib/settingsService";
import { supabase } from "@/lib/supabase";

interface ChatMessage {
  id: string;
  from: "winny" | "user";
  text: string;
  options?: QuickOption[];
  timestamp: Date;
}

interface QuickOption {
  label: string;
  value: string;
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_START: QuickOption[] = [
  { label: "💰 Pricing",         value: "What are your prices?" },
  { label: "🔍 Services",        value: "What services do you offer?" },
  { label: "📅 Book a wash",     value: "How do I book a service?" },
  { label: "⭐ Loyalty rewards", value: "How does your loyalty programme work?" },
  { label: "📍 Service areas",   value: "Where do you operate?" },
  { label: "💳 Subscriptions",   value: "Tell me about your subscription plans" },
];

// Local fallback — only used if AI call fails
const FALLBACK_FAQS: { patterns: string[]; answer: string; followUp?: QuickOption[] }[] = [
  {
    patterns: ["price", "cost", "how much", "pricing", "rates"],
    answer: "Our prices vary by service and vehicle size:\n\n🚗 **Basic Exterior Wash** — from N$80\n🧹 **Basic Interior Clean** — from N$60\n💎 **Full Detailing** — from N$120\n⚙️ **Engine Bay** — N$50 add-on\n\nCheck our booking page for the full price list!",
    followUp: [
      { label: "📅 Book now", value: "How do I book a service?" },
      { label: "🔍 See services", value: "What services do you offer?" },
    ],
  },
  {
    patterns: ["service", "services", "offer", "detailing", "wash"],
    answer: "We offer:\n\n✨ **Basic Wash (Exterior)** — hand wash, rinse & dry\n🫧 **Basic Wash (Interior)** — vacuum, wipe-down & windows\n💎 **Full Detailing** — complete interior + exterior detail\n⚙️ **Engine Bay Cleaning** — add-on degreasing\n\nWe come to you!",
    followUp: [
      { label: "💰 See prices", value: "What are your prices?" },
      { label: "📅 Book now", value: "How do I book a service?" },
    ],
  },
  {
    patterns: ["book", "booking", "schedule", "appointment"],
    answer: "Booking is easy! Just:\n\n1. Choose your service\n2. Pick vehicle size\n3. Select date & time\n4. Drop a location pin\n5. Submit — we confirm on WhatsApp! 🚗",
    followUp: [
      { label: "💰 Pricing", value: "What are your prices?" },
    ],
  },
  {
    patterns: ["area", "location", "where", "windhoek", "namibia"],
    answer: "We serve **Windhoek and surrounding areas** in Namibia 🇳🇦\n\nWe come to your home, office, hotel — wherever works for you!",
    followUp: [{ label: "📅 Book now", value: "How do I book a service?" }],
  },
  {
    patterns: ["payment", "pay", "cash", "eft", "transfer"],
    answer: "We accept:\n\n💵 **Cash** · 🏦 **EFT** · 📱 **eWallet / Pay2Cell**\n\nPayment due after service when you're happy!",
    followUp: [{ label: "📅 Book now", value: "How do I book a service?" }],
  },
  {
    patterns: ["loyalty", "points", "reward", "free wash"],
    answer: "Earn **10 points** per booking and redeem them for **FREE car washes**! 🌟\n\nTiers: Bronze → Silver → Gold → Platinum\n\nCreate an account to start earning.",
    followUp: [{ label: "📅 Book now", value: "How do I book a service?" }],
  },
  {
    patterns: ["subscription", "plan", "monthly"],
    answer: "3 plans available:\n\n📦 **Basic** — 2 washes/month · N$250\n📦 **Standard** — 4 washes/month · N$450\n👑 **Premium** — 4 washes + 1 detail · N$650",
    followUp: [{ label: "📅 Book now", value: "How do I book a service?" }],
  },
];

function findFallback(input: string) {
  const lower = input.toLowerCase();
  for (const faq of FALLBACK_FAQS) {
    if (faq.patterns.some(p => lower.includes(p))) return faq;
  }
  return null;
}

let _mid = 0;
const mid = () => String(++_mid);

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <span>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={li}>
            {parts.map((part, pi) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={pi}>{part.slice(2, -2)}</strong>
                : <span key={pi}>{part}</span>
            )}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </span>
  );
}

export default function WinnyChatbot() {
  const [open, setOpen]             = useState(false);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput]           = useState("");
  const [typing, setTyping]         = useState(false);
  const [waNumber, setWaNumber]     = useState("264812781123");
  const [pulse, setPulse]           = useState(true);
  const [unread, setUnread]         = useState(1);
  const [aiAvailable, setAiAvailable] = useState(true);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSetting(SETTINGS_KEYS.WHATSAPP_AGENT_NUMBER)
      .then(v => { if (v) setWaNumber(v.replace(/\D/g, "")); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    if (messages.length > 0) return;
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setMessages([{
        id: mid(), from: "winny",
        text: "Hey there! 👋 I'm **Winny**, your Oasis assistant!\n\nI can help with services, pricing, bookings, and more. What's on your mind?",
        options: QUICK_START,
        timestamp: new Date(),
      }]);
    }, 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const askWinny = useCallback(async (userText: string, newHistory: ApiMessage[]) => {
    setTyping(true);
    try {
      const { data, error } = await supabase.functions.invoke("winny-chat", {
        body: { messages: newHistory },
      });

      setTyping(false);

      if (!error && data?.reply) {
        const reply = data.reply as string;
        setApiHistory(prev => [
          ...prev,
          { role: "user", content: userText },
          { role: "assistant", content: reply },
        ]);
        setMessages(prev => [...prev, {
          id: mid(), from: "winny", text: reply,
          options: [
            { label: "💬 Talk to agent", value: "__whatsapp__" },
            { label: "🔙 Main topics",   value: "__restart__" },
          ],
          timestamp: new Date(),
        }]);
        return;
      }
      throw new Error("No reply");
    } catch {
      setTyping(false);
      setAiAvailable(false);
      const fallback = findFallback(userText);
      if (fallback) {
        setMessages(prev => [...prev, {
          id: mid(), from: "winny", text: fallback.answer,
          options: fallback.followUp ?? [
            { label: "💬 Talk to agent", value: "__whatsapp__" },
            { label: "🔙 More topics",   value: "__restart__" },
          ],
          timestamp: new Date(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: mid(), from: "winny",
          text: "I'm having a little trouble right now 🤔\n\nFor the fastest answer, chat with our team on WhatsApp!",
          options: [
            { label: "💬 Chat on WhatsApp", value: "__whatsapp__" },
            { label: "🔙 Browse topics",    value: "__restart__" },
          ],
          timestamp: new Date(),
        }]);
      }
    }
  }, []);

  const handleOption = useCallback((value: string) => {
    if (value === "__whatsapp__") {
      const msg = encodeURIComponent("Hi Oasis! I'd like to find out more about your services.");
      window.open(`https://wa.me/${waNumber}?text=${msg}`, "_blank");
      setMessages(prev => [...prev, {
        id: mid(), from: "winny",
        text: "I've opened WhatsApp for you! 🚀\n\nOur team will get back to you as soon as possible (Mon–Sat, 7AM–6PM).",
        options: [{ label: "🔙 Back to topics", value: "__restart__" }],
        timestamp: new Date(),
      }]);
      return;
    }
    if (value === "__restart__") {
      setMessages(prev => [...prev, {
        id: mid(), from: "winny",
        text: "Sure thing! Here's what I can help with:",
        options: QUICK_START,
        timestamp: new Date(),
      }]);
      return;
    }
    const userMsg: ChatMessage = { id: mid(), from: "user", text: value, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const newHistory: ApiMessage[] = [...apiHistory, { role: "user", content: value }];
    setApiHistory(newHistory);
    askWinny(value, newHistory);
  }, [waNumber, apiHistory, askWinny]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    const userMsg: ChatMessage = { id: mid(), from: "user", text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const newHistory: ApiMessage[] = [...apiHistory, { role: "user", content: text }];
    setApiHistory(newHistory);
    askWinny(text, newHistory);
  }, [input, typing, apiHistory, askWinny]);

  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent("Hi Oasis! I'd like to find out more.")}`;

  return (
    <>
      <div className="fixed bottom-20 right-4 z-[700] flex flex-col items-end gap-2">
        <AnimatePresence>
          {!open && pulse && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 10 }}
              className="bg-card border border-border shadow-lg rounded-2xl rounded-br-none px-3 py-2 text-xs font-semibold text-foreground whitespace-nowrap max-w-[200px]"
            >
              👋 Hi! I'm Winny — ask me anything!
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setOpen(o => !o)}
          className="relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%)" }}
          aria-label="Open Winny chatbot"
        >
          {pulse && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ background: "#FF8C00" }} />
          )}
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="w-6 h-6 text-white" />
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <span className="font-black text-xl text-white select-none">W</span>
              </motion.div>
            )}
          </AnimatePresence>
          {!open && unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-36 right-4 z-[700] w-[calc(100vw-32px)] sm:w-[360px] max-h-[72vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-border"
            style={{ background: "hsl(var(--card))" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-lg shrink-0"
                  style={{ background: "linear-gradient(135deg,#FF8C00,#ffb347)" }}>W</div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-white leading-tight">Winny</p>
                    {aiAvailable && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white/80"
                        style={{ background: "rgba(255,140,0,0.25)" }}>
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-blue-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    Oasis Assistant · Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={waHref} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition text-green-400"
                  title="Chat on WhatsApp">
                  <MessageCircle className="w-4 h-4" />
                </a>
                <button onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
              style={{ background: "hsl(var(--background))" }}>
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                  {msg.from === "winny" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 mb-1"
                      style={{ background: "linear-gradient(135deg,#FF8C00,#ffb347)" }}>W</div>
                  )}
                  <div className="flex flex-col gap-2 max-w-[82%]">
                    <div
                      className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.from === "user" ? "text-white rounded-br-sm" : "rounded-bl-sm"}`}
                      style={msg.from === "user"
                        ? { background: "#0a1628" }
                        : { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    >
                      <FormattedText text={msg.text} />
                    </div>
                    {msg.options && msg.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.options.map(opt => (
                          <button key={opt.value} onClick={() => handleOption(opt.value)}
                            className="px-2.5 py-1 rounded-full text-xs font-semibold border transition hover:scale-105 active:scale-95"
                            style={{ borderColor: "#FF8C00", color: "#FF8C00", background: "rgba(255,140,0,0.08)" }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0"
                    style={{ background: "linear-gradient(135deg,#FF8C00,#ffb347)" }}>W</div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm border"
                    style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
                    <div className="flex gap-1 items-center">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 px-3 py-3 border-t border-border flex gap-2 items-center"
              style={{ background: "hsl(var(--card))" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !typing && handleSend()}
                placeholder="Ask me anything…"
                disabled={typing}
                className="flex-1 px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || typing}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                style={{ background: "#FF8C00" }}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* WhatsApp footer */}
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              className="shrink-0 flex items-center justify-center gap-2 py-2 text-[10px] font-semibold transition hover:opacity-80"
              style={{ background: "#25D366", color: "#fff" }}>
              <MessageCircle className="w-3.5 h-3.5" />
              Chat with a live agent on WhatsApp
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
