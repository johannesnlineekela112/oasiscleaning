/**
 * WinnyChatbot.tsx
 * 
 * Winny — Oasis Pure Cleaning CC's friendly chatbot.
 * Always visible (fixed, above all ads), handles FAQs and redirects to WhatsApp.
 * WhatsApp number is loaded from app_settings (key: whatsapp_agent_number).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Send, ChevronDown } from "lucide-react";
import { getSetting, SETTINGS_KEYS } from "@/lib/settingsService";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  from: "winny" | "user";
  text: string;
  options?: QuickOption[];
  isWhatsApp?: boolean;
  timestamp: Date;
}

interface QuickOption {
  label: string;
  value: string;
}

// ── FAQ knowledge base ───────────────────────────────────────────────────────

const FAQS: { patterns: string[]; answer: string; followUp?: QuickOption[] }[] = [
  {
    patterns: ["price", "cost", "how much", "pricing", "rates", "rate", "charge"],
    answer: "Our prices depend on your vehicle size and services chosen:\n\n🚗 **Small vehicles** start from N$ 80\n🚙 **Large vehicles** start from N$ 120\n🚐 **XL vehicles** start from N$ 160\n\nPrices vary by service. You can see all exact prices on our booking page!",
    followUp: [
      { label: "📅 Book now", value: "book" },
      { label: "🔍 What services?", value: "services" },
    ],
  },
  {
    patterns: ["service", "services", "what do you offer", "what you do", "offer", "wash type", "detailing"],
    answer: "We offer a full range of mobile car care services:\n\n✨ **Basic Wash** — exterior wash & dry\n🫧 **Interior Clean** — vacuum & wipe-down\n💎 **Full Detailing** — interior + exterior deep clean\n🪟 **Window Polish** — streak-free shine\n🛞 **Tyre Shine** — glossy tyre treatment\n\nAll services come to YOU — we're fully mobile!",
    followUp: [
      { label: "💰 See prices", value: "price" },
      { label: "📅 Book now", value: "book" },
    ],
  },
  {
    patterns: ["book", "booking", "schedule", "appointment", "reserve"],
    answer: "Booking is super easy! 🎉\n\n1. Select your **service type**\n2. Pick your **vehicle size**\n3. Choose a **date & time**\n4. Drop a **pin on the map** for your location\n5. Submit — we'll confirm via WhatsApp!\n\nYou can book right here on the page 👇",
    followUp: [
      { label: "📍 How far do you travel?", value: "area" },
      { label: "💳 Payment options?", value: "payment" },
    ],
  },
  {
    patterns: ["area", "location", "where", "travel", "come to", "deliver", "windhoek", "namibia"],
    answer: "We serve **Windhoek and surrounding areas** in Namibia 🇳🇦\n\nWe come to your:\n🏠 Home\n🏢 Office\n🏨 Hotel\n🏬 Shopping centre parking\n\nJust drop a pin on our map when booking and we'll confirm if we can reach you!",
    followUp: [
      { label: "📅 Book now", value: "book" },
      { label: "⏰ Working hours?", value: "hours" },
    ],
  },
  {
    patterns: ["hour", "hours", "time", "open", "available", "when", "operating", "schedule"],
    answer: "We're available **Monday to Saturday**, 7:00 AM – 6:00 PM 🕖\n\nSundays and public holidays are available on request — contact us on WhatsApp to arrange!",
    followUp: [
      { label: "📅 Book a slot", value: "book" },
      { label: "💬 Chat with us", value: "whatsapp" },
    ],
  },
  {
    patterns: ["payment", "pay", "cash", "card", "eft", "transfer", "bank"],
    answer: "We accept multiple payment methods:\n\n💵 **Cash** — on the day of service\n🏦 **EFT** — direct bank transfer\n📱 **Bank App Transfer** — instant payment\n\nPayment is due after the service is completed and you're happy!",
    followUp: [
      { label: "📅 Book now", value: "book" },
      { label: "💬 More questions?", value: "whatsapp" },
    ],
  },
  {
    patterns: ["loyalty", "points", "reward", "free wash", "earn", "redeem"],
    answer: "Our **Loyalty Programme** rewards you for every booking! 🌟\n\n⭐ Earn **10 points** per service\n🥈 Silver tier — 50+ points\n🥇 Gold tier — 100+ points\n👑 Platinum tier — 200+ points\n\nEarn enough points and redeem them for a **FREE car wash!** Create an account to start earning.",
    followUp: [
      { label: "👤 Create account", value: "account" },
      { label: "📅 Book now", value: "book" },
    ],
  },
  {
    patterns: ["account", "sign up", "register", "login", "profile", "create account"],
    answer: "Creating an account unlocks great benefits:\n\n✅ Track all your bookings\n⭐ Earn loyalty points\n🎁 Redeem free washes\n📊 View your service history\n\nTap **Sign Up** on the booking page — it only takes 30 seconds!",
    followUp: [
      { label: "⭐ Loyalty benefits", value: "loyalty" },
      { label: "📅 Book now", value: "book" },
    ],
  },
  {
    patterns: ["cancel", "cancellation", "reschedule", "change booking", "postpone"],
    answer: "Need to cancel or reschedule? No problem!\n\n📱 Log into your account and manage bookings from your dashboard.\n\n⚠️ **Note:** Cancellations within 2 hours of your booking time may attract a late cancellation fee.\n\nFor urgent changes, contact us on WhatsApp and we'll sort it out quickly!",
    followUp: [
      { label: "💬 WhatsApp us", value: "whatsapp" },
      { label: "👤 My account", value: "account" },
    ],
  },
  {
    patterns: ["vip", "premium", "special", "upgrade"],
    answer: "Our **VIP Service** gives you the premium experience ⭐\n\n👑 Priority booking slots\n✨ Enhanced detailing attention\n🎁 VIP pricing (20% premium for premium service)\n\nVIP status is applied at booking — look out for the VIP toggle when booking!",
    followUp: [
      { label: "📅 Book VIP now", value: "book" },
      { label: "💰 See pricing", value: "price" },
    ],
  },
  {
    patterns: ["referral", "refer", "friend", "code", "invite"],
    answer: "Our **Referral Programme** lets you earn together! 🤝\n\nShare your unique referral code with friends.\nWhen they sign up, you **both earn bonus loyalty points!**\n\nFind your referral code in your account dashboard under the Loyalty tab.",
    followUp: [
      { label: "👤 My account", value: "account" },
      { label: "⭐ Loyalty info", value: "loyalty" },
    ],
  },
  {
    patterns: ["contact", "phone", "call", "reach", "talk", "speak", "human", "agent", "person"],
    answer: "Want to speak to a real person? We're just a tap away! 📞\n\nOur friendly team is ready to help you via WhatsApp — fastest response guaranteed!",
    followUp: [
      { label: "💬 Open WhatsApp", value: "whatsapp" },
    ],
  },
  {
    patterns: ["hello", "hi", "hey", "howzit", "good day", "morning", "afternoon", "greet"],
    answer: "Hey there! 👋 I'm **Winny**, your Oasis Pure Cleaning assistant!\n\nI can help you with bookings, pricing, services, and more. What can I help you with today?",
    followUp: [
      { label: "📅 Book a wash", value: "book" },
      { label: "💰 Pricing", value: "price" },
      { label: "🔍 Services", value: "services" },
      { label: "💬 Talk to agent", value: "whatsapp" },
    ],
  },
];

const QUICK_START: QuickOption[] = [
  { label: "📅 Book a wash", value: "book" },
  { label: "💰 Pricing", value: "price" },
  { label: "🔍 Our services", value: "services" },
  { label: "⭐ Loyalty points", value: "loyalty" },
  { label: "📍 Service areas", value: "area" },
  { label: "💬 Talk to agent", value: "whatsapp" },
];

// ── ID generator ──────────────────────────────────────────────────────────────

let _mid = 0;
const mid = () => String(++_mid);

// ── Helper: find FAQ answer ───────────────────────────────────────────────────

function findAnswer(input: string): { answer: string; followUp?: QuickOption[] } | null {
  const lower = input.toLowerCase();
  for (const faq of FAQS) {
    if (faq.patterns.some(p => lower.includes(p))) {
      return { answer: faq.answer, followUp: faq.followUp };
    }
  }
  return null;
}

// ── Format message text (supports **bold** and \n) ───────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

interface WinnyChatbotProps {
  /** Called when the chat panel opens or closes — lets parent offset the sidebar ad */
  onOpenChange?: (open: boolean) => void;
}

export default function WinnyChatbot({ onOpenChange }: WinnyChatbotProps = {}) {
  const [open, setOpen]         = useState(false);
  // Proxy that also notifies the parent (used for ad positioning)
  const handleSetOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    setOpen(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      onOpenChange?.(next);
      return next;
    });
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [waNumber, setWaNumber] = useState("264812781123");
  const [pulse, setPulse]       = useState(true);
  const [unread, setUnread]     = useState(1);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Load WhatsApp number from settings
  useEffect(() => {
    getSetting(SETTINGS_KEYS.WHATSAPP_AGENT_NUMBER)
      .then(v => { if (v) setWaNumber(v.replace(/\D/g, "")); })
      .catch(() => {});
  }, []);

  // Stop pulsing after 5 s
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Greeting message on first open
  useEffect(() => {
    if (!open) return;
    setUnread(0);
    if (messages.length > 0) return;
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setMessages([{
        id: mid(),
        from: "winny",
        text: "Hey there! 👋 I'm **Winny**, your Oasis assistant!\n\nHow can I help you today?",
        options: QUICK_START,
        timestamp: new Date(),
      }]);
    }, 800);
    return () => clearTimeout(t);
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const pushWinny = useCallback((text: string, opts?: QuickOption[], isWhatsApp?: boolean) => {
    setTyping(true);
    const delay = 600 + Math.min(text.length * 8, 1200);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, {
        id: mid(), from: "winny", text, options: opts, isWhatsApp, timestamp: new Date(),
      }]);
    }, delay);
  }, []);

  const handleOption = useCallback((value: string) => {
    if (value === "whatsapp") {
      const msg = encodeURIComponent("Hi Oasis! I'd like to find out more about your services.");
      window.open(`https://wa.me/${waNumber}?text=${msg}`, "_blank");
      pushWinny(
        "I've opened WhatsApp for you! 🚀\n\nOur team will respond as soon as possible during business hours (Mon–Sat, 7AM–6PM).",
        [{ label: "🔙 Back to FAQs", value: "restart" }],
        true,
      );
      return;
    }
    if (value === "restart") {
      pushWinny("What else can I help you with?", QUICK_START);
      return;
    }
    // Find matching FAQ
    const found = findAnswer(value);
    if (found) {
      const followUp = found.followUp ?? [
        { label: "💬 Talk to agent", value: "whatsapp" },
        { label: "🔙 More questions", value: "restart" },
      ];
      pushWinny(found.answer, followUp);
    } else {
      pushWinny("Here are some things I can help with:", QUICK_START);
    }
  }, [waNumber, pushWinny]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    // Add user message
    setMessages(prev => [...prev, { id: mid(), from: "user", text, timestamp: new Date() }]);
    // Find answer
    const found = findAnswer(text);
    if (found) {
      const followUp = found.followUp ?? [
        { label: "💬 Talk to agent", value: "whatsapp" },
        { label: "🔙 More questions", value: "restart" },
      ];
      pushWinny(found.answer, followUp);
    } else {
      pushWinny(
        "I'm not sure about that one 🤔\n\nLet me connect you with a real person who can help!",
        [
          { label: "💬 Chat on WhatsApp", value: "whatsapp" },
          { label: "🔙 Browse FAQs", value: "restart" },
        ],
      );
    }
  }, [input, pushWinny]);

  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent("Hi Oasis! I'd like to find out more.")}`;

  return (
    <>
      {/* ── Floating button ─────────────────────────────────────────────── */}
      <div className="fixed bottom-20 right-4 z-[700] flex flex-col items-end gap-2">
        {/* Tooltip bubble */}
        <AnimatePresence>
          {!open && pulse && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 10 }}
              className="bg-card border border-border shadow-lg rounded-2xl rounded-br-none px-3 py-2 text-xs font-semibold text-foreground whitespace-nowrap max-w-[180px]"
            >
              👋 Hi! I'm Winny, ask me anything!
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => handleSetOpen(o => !o)}
          className="relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%)" }}
          aria-label="Open Winny chatbot"
        >
          {/* Pulse ring */}
          {pulse && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ background: "#FF8C00" }} />
          )}
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <ChevronDown className="w-6 h-6 text-white" />
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                {/* Winny avatar letter */}
                <span className="font-black text-xl text-white select-none">W</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Unread badge */}
          {!open && unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-36 right-4 z-[700] w-[calc(100vw-32px)] sm:w-[360px] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-border"
            style={{ background: "hsl(var(--card))" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%)" }}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-lg shrink-0"
                  style={{ background: "linear-gradient(135deg,#FF8C00,#ffb347)" }}>
                  W
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">Winny</p>
                  <p className="text-[10px] text-blue-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    Oasis Assistant · Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition text-green-400"
                  title="Chat on WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleSetOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white"
                >
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
                  <div className="flex flex-col gap-2 max-w-[80%]">
                    <div
                      className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.from === "user"
                          ? "text-white rounded-br-sm"
                          : "rounded-bl-sm"
                      }`}
                      style={msg.from === "user"
                        ? { background: "#0a1628" }
                        : { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }
                      }
                    >
                      <FormattedText text={msg.text} />
                    </div>
                    {/* Quick options */}
                    {msg.options && msg.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.options.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleOption(opt.value)}
                            className="px-2.5 py-1 rounded-full text-xs font-semibold border transition hover:scale-105 active:scale-95"
                            style={{ borderColor: "#FF8C00", color: "#FF8C00", background: "rgba(255,140,0,0.08)" }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {typing && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0"
                    style={{ background: "linear-gradient(135deg,#FF8C00,#ffb347)" }}>W</div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm border"
                    style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
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
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                style={{ background: "#FF8C00" }}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* WhatsApp footer */}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center justify-center gap-2 py-2 text-[10px] font-semibold transition hover:opacity-80"
              style={{ background: "#25D366", color: "#fff" }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat with a live agent on WhatsApp
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
