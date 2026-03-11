import { useState, useEffect, useRef } from "react";
import {
  X, Users, FileText, Star, MapPin, Phone, Mail,
  Clock, Shield, ChevronRight, Sparkles, Award,
} from "lucide-react";
import { getLegalDocument, getTeamMembers, TeamMember, LegalDocument } from "@/lib/contentService";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AboutModalProps {
  onClose: () => void;
  initialTab?: Tab;
}
type Tab = "about" | "team" | "tc";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    "#0d1f35",
  navyMid: "#1a2d4a",
  orange:  "#FF8C00",
  orangeLt:"#ffb347",
  slate:   "#64748b",
  light:   "#f8fafc",
  border:  "#e8edf3",
  white:   "#ffffff",
  text:    "#1e293b",
  muted:   "#94a3b8",
  success: "#22c55e",
};

// ─── Global CSS (injected once) ───────────────────────────────────────────────
const CSS = `
  @keyframes nm-fadeBack  { from{opacity:0} to{opacity:1} }
  @keyframes nm-slideUp   { from{opacity:0;transform:translateY(32px) scale(0.95)} to{opacity:1;transform:none} }
  @keyframes nm-spin      { to{transform:rotate(360deg)} }
  @keyframes nm-shimmer   { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
  @keyframes nm-popIn     { 0%{opacity:0;transform:scale(0.85)} 80%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1)} }

  .nm-overlay   { animation: nm-fadeBack 0.18s ease both }
  .nm-modal     { animation: nm-slideUp  0.28s cubic-bezier(0.34,1.5,0.64,1) both }
  .nm-tab       { transition:color 0.15s,border-color 0.15s,background 0.15s }
  .nm-tab:hover { color:#FF8C00!important }
  .nm-tab.on    { color:#FF8C00!important;border-bottom-color:#FF8C00!important }
  .nm-card      { transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s }
  .nm-card:hover{ transform:translateY(-3px);box-shadow:0 10px 30px rgba(255,140,0,0.13);border-color:rgba(255,140,0,0.4)!important }
  .nm-xbtn:hover{ background:rgba(255,255,255,0.22)!important }
  .nm-linkbtn:hover{ opacity:.75 }
  .nm-closebtn:hover{ opacity:.85 }
`;

// ─── Helper: Avatar initials ──────────────────────────────────────────────────
const initials = (name: string) =>
  name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

// ─── Member Card ──────────────────────────────────────────────────────────────
const MemberCard = ({ m, i }: { m: TeamMember; i: number }) => (
  <div
    className="nm-card"
    style={{
      background: T.white,
      border: `1.5px solid ${T.border}`,
      borderRadius: 20,
      padding: "20px 22px",
      display: "flex",
      gap: 18,
      alignItems: "flex-start",
      animationDelay: `${i * 60}ms`,
    }}
  >
    {m.image_url ? (
      <img
        src={m.image_url}
        alt={m.full_name}
        style={{
          width: 76, height: 76, borderRadius: 14, objectFit: "cover",
          flexShrink: 0, border: `2px solid rgba(255,140,0,0.22)`,
          boxShadow: "0 3px 12px rgba(0,0,0,0.10)",
        }}
      />
    ) : (
      <div style={{
        width: 76, height: 76, borderRadius: 14, flexShrink: 0,
        background: `linear-gradient(140deg, ${T.navyMid}, #FF8C00)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, fontWeight: 800, color: T.white,
        boxShadow: "0 4px 16px rgba(255,140,0,0.22)",
        letterSpacing: "-0.02em",
      }}>
        {initials(m.full_name)}
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 800, fontSize: 15.5, color: T.text, lineHeight: 1.25, marginBottom: 3 }}>
        {m.full_name}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.orange,
        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9,
      }}>
        {m.title}
      </div>
      <div style={{ fontSize: 13.5, color: T.slate, lineHeight: 1.65 }}>
        {m.bio}
      </div>
    </div>
  </div>
);

// ─── TC Content renderer ──────────────────────────────────────────────────────
const TCBody = ({ content }: { content: string }) => (
  <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.75 }}>
    {content.split(/\n\n+/).filter(Boolean).map((block, i) => {
      const t = block.trim();
      if (/^\d+\.\s.{1,70}$/.test(t)) {
        return (
          <div key={i} style={{ marginTop: i > 0 ? 22 : 0, marginBottom: 8 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "7px 14px", borderRadius: 8,
              background: "linear-gradient(90deg,rgba(26,45,74,0.05),transparent)",
              borderLeft: `3px solid ${T.orange}`,
              fontWeight: 800, fontSize: 12.5, color: T.navy,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {t}
            </div>
          </div>
        );
      }
      if (t.startsWith("-")) {
        return (
          <ul key={i} style={{ listStyle: "none", padding: 0, margin: "6px 0 14px" }}>
            {t.split("\n").filter(l => l.trim().startsWith("-")).map((line, j) => (
              <li key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.orange, flexShrink: 0, marginTop: 8 }} />
                <span>{line.replace(/^-\s*/, "")}</span>
              </li>
            ))}
          </ul>
        );
      }
      return <p key={i} style={{ marginBottom: 12, color: "#4b5563" }}>{t}</p>;
    })}
  </div>
);

// ─── Skeleton loader ──────────────────────────────────────────────────────────
const Skel = () => (
  <div style={{ padding: "8px 0" }}>
    {[100, 80, 90, 60, 75].map((w, i) => (
      <div key={i} style={{
        height: 14, borderRadius: 7, marginBottom: 12,
        background: `linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9)`,
        backgroundSize: "200% 100%",
        animation: "nm-shimmer 1.5s ease-in-out infinite",
        animationDelay: `${i * 120}ms`,
        width: `${w}%`,
      }} />
    ))}
  </div>
);

// ─── Schedule chip ────────────────────────────────────────────────────────────
const Chip = ({ label, vip }: { label: string; vip?: boolean }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: vip ? "rgba(255,140,0,0.1)" : T.light,
    border: `1px solid ${vip ? "rgba(255,140,0,0.3)" : T.border}`,
    color: vip ? T.orange : T.slate,
  }}>
    {vip && <Star size={9} style={{ fill: T.orange }} />}
    {label}
  </span>
);

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────
export const AboutModal = ({ onClose, initialTab = "about" }: AboutModalProps) => {
  const [tab,     setTab]    = useState<Tab>(initialTab);
  const [about,   setAbout]  = useState<LegalDocument | null>(null);
  const [tc,      setTc]     = useState<LegalDocument | null>(null);
  const [team,    setTeam]   = useState<TeamMember[]>([]);
  const [loading, setLoading]= useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getLegalDocument("about"),
      getLegalDocument("terms_conditions"),
      getTeamMembers(),
    ]).then(([a, t, tm]) => {
      setAbout(a); setTc(t); setTeam(tm); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const TABS: { id: Tab; icon: any; label: string }[] = [
    { id: "about", icon: Award,    label: "About"      },
    { id: "team",  icon: Users,    label: "Our Team"   },
    { id: "tc",    icon: Shield,   label: "Terms"      },
  ];

  const headerMap: Record<Tab, { h: string; sub: string }> = {
    about: { h: "About Oasis Pure Cleaning CC",         sub: "Technology-driven mobile car care, built on precision" },
    team:  { h: "Meet the Founders",      sub: "The people behind every perfectly detailed vehicle" },
    tc:    { h: "Terms & Conditions",     sub: `v${tc?.version || 1} · Effective upon booking or account creation` },
  };

  return (
    <div
      ref={overlayRef}
      className="nm-overlay"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(8,18,32,0.82)",
        backdropFilter: "blur(12px) saturate(1.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 12,
      }}
    >
      <style>{CSS}</style>

      <div
        className="nm-modal"
        style={{
          width: "100%", maxWidth: 700, maxHeight: "92vh",
          display: "flex", flexDirection: "column",
          borderRadius: 24,
          overflow: "hidden",
          background: T.white,
          boxShadow: "0 48px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >

        {/* ╔══ HEADER ══════════════════════════════════════════════════════╗ */}
        <div style={{
          background: `linear-gradient(150deg, ${T.navy} 0%, ${T.navyMid} 55%, #203a58 100%)`,
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative glow orbs */}
          <div style={{
            position:"absolute", top:-60, right:-60, width:240, height:240, borderRadius:"50%",
            background:"radial-gradient(circle,rgba(255,140,0,0.18) 0%,transparent 65%)",
            pointerEvents:"none",
          }} />
          <div style={{
            position:"absolute", bottom:-50, left:"25%", width:180, height:180, borderRadius:"50%",
            background:"radial-gradient(circle,rgba(255,140,0,0.09) 0%,transparent 65%)",
            pointerEvents:"none",
          }} />

          {/* Brand row */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"18px 24px 0",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{
                width:32, height:32, borderRadius:9,
                background:`linear-gradient(135deg,${T.orange},${T.orangeLt})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 2px 10px rgba(255,140,0,0.4)",
              }}>
                <Sparkles size={15} color="white" />
              </div>
              <span style={{
                fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.85)",
                letterSpacing:"0.14em", textTransform:"uppercase",
              }}>
                NAMSHINE DETAILING
              </span>
            </div>
            <button
              className="nm-xbtn"
              onClick={onClose}
              style={{
                width:34, height:34, borderRadius:10, cursor:"pointer",
                border:"1px solid rgba(255,255,255,0.14)",
                background:"rgba(255,255,255,0.08)",
                color:"rgba(255,255,255,0.65)",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"background 0.15s",
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Section headline */}
          <div style={{ padding:"12px 24px 18px" }}>
            <div style={{ fontSize:23, fontWeight:800, color:T.white, letterSpacing:"-0.02em", lineHeight:1.2, marginBottom:3 }}>
              {headerMap[tab].h}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", letterSpacing:"0.01em" }}>
              {headerMap[tab].sub}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display:"flex", padding:"0 20px", gap:0, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`nm-tab${tab === id ? " on" : ""}`}
                onClick={() => setTab(id)}
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"11px 18px",
                  border:"none",
                  borderBottom:`2px solid ${tab === id ? T.orange : "transparent"}`,
                  background:"transparent",
                  color: tab === id ? T.orange : "rgba(255,255,255,0.45)",
                  fontWeight: tab === id ? 700 : 500,
                  fontSize:13, cursor:"pointer",
                  letterSpacing:"0.01em", whiteSpace:"nowrap",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ╔══ CONTENT ═════════════════════════════════════════════════════╗ */}
        <div
          ref={scrollRef}
          style={{ overflowY:"auto", flex:1, padding:24, background:"#f5f7fa" }}
        >
          {loading ? <Skel /> : tab === "about" ? (

            /* ── ABOUT ── */
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Intro card */}
              <div style={{
                background:T.white, borderRadius:18, padding:"22px 24px",
                border:`1px solid ${T.border}`,
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                  <div style={{
                    width:26, height:26, borderRadius:7,
                    background:`linear-gradient(135deg,${T.orange},${T.orangeLt})`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:"0 2px 8px rgba(255,140,0,0.3)",
                  }}>
                    <Award size={12} color="white" />
                  </div>
                  <span style={{ fontWeight:800, fontSize:11, color:T.navyMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>
                    Who We Are
                  </span>
                </div>
                {(about?.content || "").split("\n\n").filter(Boolean).map((p, i, arr) => (
                  <p key={i} style={{
                    fontSize:14, color:"#374151", lineHeight:1.8,
                    marginBottom: i < arr.length - 1 ? 12 : 0,
                  }}>
                    {p.trim()}
                  </p>
                ))}
              </div>

              {/* Stats */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {[
                  { icon: Clock,   val:"7 Days",  lbl:"Per Week" },
                  { icon: Star,    val:"9 Slots",  lbl:"Daily Windows" },
                  { icon: Shield,  val:"100%",     lbl:"Digital" },
                ].map(({ icon: Icon, val, lbl }) => (
                  <div key={lbl} style={{
                    background:T.white, border:`1px solid ${T.border}`,
                    borderRadius:14, padding:"14px 12px",
                    textAlign:"center",
                    boxShadow:"0 2px 8px rgba(0,0,0,0.03)",
                  }}>
                    <Icon size={16} style={{ color:T.orange, marginBottom:6 }} />
                    <div style={{ fontWeight:800, fontSize:18, color:T.navyMid, lineHeight:1 }}>{val}</div>
                    <div style={{ fontSize:10, color:T.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginTop:3 }}>{lbl}</div>
                  </div>
                ))}
              </div>

              {/* Operating hours */}
              <div style={{
                background:T.white, border:`1px solid ${T.border}`,
                borderRadius:18, padding:"20px 22px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <Clock size={14} style={{ color:T.orange }} />
                    <span style={{ fontWeight:800, fontSize:12, color:T.navyMid, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                      Operating Hours
                    </span>
                  </div>
                  <span style={{ fontSize:11, color:T.muted, fontWeight:600 }}>Mon – Sun</span>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.slate, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Standard</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {["08:00–09:30","09:30–11:00","11:00–12:30","13:00–14:30","14:30–16:00"].map(s => <Chip key={s} label={s} />)}
                  </div>
                </div>
                <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.orange, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
                    ⭐ VIP After-Hours (1.5× pricing)
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {["17:00–18:30","18:30–19:30"].map(s => <Chip key={s} label={s} vip />)}
                  </div>
                </div>
              </div>

              {/* Commitment banner */}
              <div style={{
                background:`linear-gradient(150deg,${T.navy},#1e3a5f)`,
                borderRadius:18, padding:"22px 24px", color:T.white,
              }}>
                <div style={{ fontSize:10, fontWeight:800, color:T.orange, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>
                  Our Commitment
                </div>
                <p style={{ fontSize:14, lineHeight:1.75, color:"rgba(255,255,255,0.82)", marginBottom:14 }}>
                  We combine mobile convenience with structured execution. Oasis Pure Cleaning CC is built for customers who expect more than "a wash." They expect professionalism.
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                  {["Reliability","Time Efficiency","Transparent Pricing","Clean Execution"].map(v => (
                    <div key={v} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"rgba(255,255,255,0.65)" }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:T.orange, flexShrink:0 }} />
                      {v}
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div style={{
                background:T.white, border:`1px solid ${T.border}`,
                borderRadius:18, padding:"20px 22px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontWeight:800, fontSize:12, color:T.navyMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>
                  Get in Touch
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { icon:MapPin, label:"Windhoek, Namibia",        href:undefined },
                    { icon:Phone,  label:"+264 814 902 078",         href:"tel:+264814902078" },
                    { icon:Mail,   label:"info@oasispurecleaning.com",        href:"mailto:info@oasispurecleaning.com" },
                    { icon:Mail,   label:"marketing@oasispurecleaning.com",   href:"mailto:marketing@oasispurecleaning.com" },
                  ].map(({ icon:Icon, label, href }) => (
                    <a
                      key={label}
                      href={href || "#"}
                      onClick={e => { if (!href) e.preventDefault(); }}
                      style={{
                        display:"flex", alignItems:"center", gap:11,
                        padding:"9px 12px", borderRadius:10,
                        background:T.light, textDecoration:"none",
                        fontSize:13.5, color: href ? T.text : T.slate,
                        fontWeight: href ? 500 : 400,
                        transition:"opacity 0.15s",
                      }}
                    >
                      <div style={{
                        width:30, height:30, borderRadius:8, flexShrink:0,
                        background:"rgba(255,140,0,0.1)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        <Icon size={13} style={{ color:T.orange }} />
                      </div>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

          ) : tab === "team" ? (

            /* ── TEAM ── */
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{
                background:T.white, border:`1px solid ${T.border}`,
                borderRadius:16, padding:"14px 18px",
                fontSize:13.5, color:T.slate, lineHeight:1.65,
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              }}>
                Oasis Pure Cleaning CC is founded and operated by a focused executive team, each owning a distinct pillar: operations, systems, and strategy creating an integrated structure built for scale.
              </div>
              {team.length === 0 ? (
                <div style={{
                  textAlign:"center", padding:"60px 20px",
                  background:T.white, borderRadius:18, border:`1px solid ${T.border}`,
                }}>
                  <Users size={38} style={{ color:T.muted, marginBottom:12 }} />
                  <div style={{ fontWeight:700, fontSize:15, color:T.navyMid, marginBottom:5 }}>Profiles coming soon</div>
                  <p style={{ fontSize:13, color:T.muted }}>Our leadership team profiles are being finalized.</p>
                </div>
              ) : team.map((m, i) => <MemberCard key={m.id} m={m} i={i} />)}
            </div>

          ) : (

            /* ── TERMS ── */
            <div>
              {/* Version strip */}
              <div style={{
                background:T.white, border:`1px solid ${T.border}`,
                borderRadius:16, padding:"15px 20px", marginBottom:16,
                display:"flex", alignItems:"center", justifyContent:"space-between",
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{
                    width:34, height:34, borderRadius:10,
                    background:"rgba(255,140,0,0.1)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <Shield size={16} style={{ color:T.orange }} />
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:T.navyMid }}>
                      {tc?.title || "Terms & Conditions"}
                    </div>
                    {tc && (
                      <div style={{ fontSize:11, color:T.muted, marginTop:1 }}>
                        v{tc.version} · Updated {new Date(tc.updated_at).toLocaleDateString("en-NA", { year:"numeric", month:"long", day:"numeric" })}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{
                  background:"rgba(255,140,0,0.1)", color:T.orange,
                  fontSize:11, fontWeight:800, padding:"5px 12px",
                  borderRadius:20, border:"1px solid rgba(255,140,0,0.22)",
                  letterSpacing:"0.04em",
                }}>
                  v{tc?.version || 1}
                </div>
              </div>

              {/* Preamble */}
              <div style={{
                background:"linear-gradient(135deg,rgba(26,45,74,0.04),rgba(255,140,0,0.04))",
                border:"1px solid rgba(255,140,0,0.16)",
                borderRadius:14, padding:"13px 18px", marginBottom:16,
                fontSize:13.5, color:"#374151", lineHeight:1.7,
              }}>
                These Terms & Conditions govern use of Oasis Pure Cleaning CC's booking platform and services. By submitting a booking or creating an account, you agree to all of the following:
              </div>

              {/* Content */}
              <div style={{
                background:T.white, border:`1px solid ${T.border}`,
                borderRadius:16, padding:"22px 24px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              }}>
                {tc?.content
                  ? <TCBody content={tc.content} />
                  : <p style={{ color:T.muted, fontSize:14, textAlign:"center", padding:"30px 0" }}>
                      Terms & Conditions not yet available.
                    </p>
                }
              </div>
            </div>
          )}
        </div>

        {/* ╔══ FOOTER ══════════════════════════════════════════════════════╗ */}
        <div style={{
          flexShrink:0,
          borderTop:`1px solid ${T.border}`,
          padding:"13px 24px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:T.white, gap:12,
        }}>
          <span style={{ fontSize:11, color:T.muted }}>
            © {new Date().getFullYear()} Oasis Pure Cleaning CC · Windhoek, Namibia
          </span>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {tab !== "tc" && (
              <button
                className="nm-linkbtn"
                onClick={() => setTab("tc")}
                style={{
                  display:"flex", alignItems:"center", gap:4,
                  fontSize:11, color:T.slate, fontWeight:600,
                  background:"none", border:"none", cursor:"pointer",
                  transition:"opacity 0.15s",
                }}
              >
                <FileText size={11} /> Terms <ChevronRight size={10} />
              </button>
            )}
            <button
              className="nm-closebtn"
              onClick={onClose}
              style={{
                background: tab === "tc"
                  ? `linear-gradient(135deg,${T.orange},${T.orangeLt})`
                  : T.light,
                color: tab === "tc" ? T.white : T.navyMid,
                border: `1px solid ${tab === "tc" ? "transparent" : T.border}`,
                borderRadius:10, padding:"8px 18px",
                fontSize:12, fontWeight:700, cursor:"pointer",
                boxShadow: tab === "tc" ? "0 4px 14px rgba(255,140,0,0.32)" : "none",
                transition:"all 0.15s",
              }}
            >
              {tab === "tc" ? "Understood — Close" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── TC Checkbox ──────────────────────────────────────────────────────────────
interface TCCheckboxProps {
  checked:  boolean;
  onChange: (v: boolean) => void;
  onViewTC: () => void;
  error?:   string;
}

export const TCCheckbox = ({ checked, onChange, onViewTC, error }: TCCheckboxProps) => (
  <div>
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); } }}
      style={{
        display:"flex", alignItems:"flex-start", gap:12,
        padding:"13px 16px", borderRadius:12, cursor:"pointer",
        border:`1.5px solid ${error ? "#ef4444" : checked ? "rgba(255,140,0,0.45)" : "#e2e8f0"}`,
        background: error
          ? "rgba(239,68,68,0.04)"
          : checked
          ? "linear-gradient(135deg,rgba(255,140,0,0.07),rgba(255,179,71,0.04))"
          : "#fafafa",
        boxShadow: checked ? "0 2px 14px rgba(255,140,0,0.14)" : "none",
        transition:"all 0.2s",
        userSelect:"none",
      }}
    >
      {/* Box */}
      <div style={{
        width:22, height:22, borderRadius:7, flexShrink:0, marginTop:1,
        border:`2px solid ${checked ? T.orange : "#cbd5e1"}`,
        background: checked ? `linear-gradient(135deg,${T.orange},${T.orangeLt})` : "transparent",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow: checked ? "0 2px 8px rgba(255,140,0,0.35)" : "none",
        transition:"all 0.2s",
      }}>
        {checked && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      {/* Label */}
      <span style={{ fontSize:13.5, color:"#374151", lineHeight:1.55, paddingTop:2 }}>
        I agree to Oasis Pure Cleaning CC's{" "}
        <span
          onClick={e => { e.stopPropagation(); onViewTC(); }}
          style={{
            color:T.orange, fontWeight:700,
            textDecoration:"underline", textUnderlineOffset:2,
            cursor:"pointer",
          }}
        >
          Terms & Conditions
        </span>
      </span>
    </div>
    {error && (
      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, fontSize:12, color:"#ef4444" }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="5.5" stroke="#ef4444" strokeWidth="1.5"/>
          <path d="M6.5 4v3.5M6.5 9.5v.3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {error}
      </div>
    )}
  </div>
);

export default AboutModal;
