/**
 * WebsiteManager.tsx  —  v2
 *
 * Admin panel for editing all public-facing website content.
 * Sections: hero, about, contact, how_it_works, features,
 *           cta_band, reviews_section, pricing_section, footer.
 *
 * Banking details → managed in Settings tab.
 * Services pricing → managed in Settings tab.
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Loader2, CheckCircle, Globe, Info, Phone,
  Users, Zap, MessageCircle, Star, DollarSign, FileText,
  ExternalLink, AlertCircle,
} from "lucide-react";
import { getAllWebsiteContent, saveWebsiteSection, type WebsiteSection } from "@/lib/websiteService";

type SubTab =
  | "hero" | "about" | "contact" | "how_it_works"
  | "features" | "cta_band" | "reviews_section" | "pricing_section" | "footer";

const SUB_TABS: { key: SubTab; label: string; icon: any; group: string }[] = [
  { key: "hero",            label: "Hero",           icon: Globe,           group: "Page Sections" },
  { key: "about",           label: "About Us",       icon: Users,           group: "Page Sections" },
  { key: "how_it_works",    label: "How It Works",   icon: Info,            group: "Page Sections" },
  { key: "features",        label: "Why Oasis",      icon: Zap,             group: "Page Sections" },
  { key: "contact",         label: "Contact",        icon: Phone,           group: "Page Sections" },
  { key: "cta_band",        label: "CTA Banner",     icon: MessageCircle,   group: "Misc Sections" },
  { key: "reviews_section", label: "Reviews",        icon: Star,            group: "Misc Sections" },
  { key: "pricing_section", label: "Pricing",        icon: DollarSign,      group: "Misc Sections" },
  { key: "footer",          label: "Footer",         icon: FileText,        group: "Misc Sections" },
];

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>}
    </div>
  );
}

export function WebsiteManager() {
  const [subTab,  setSubTab]  = useState<SubTab>("hero");
  const [content, setContent] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAllWebsiteContent()
      .then(setContent)
      .catch(() => setError("Failed to load website content"))
      .finally(() => setLoading(false));
  }, []);

  const sec = content[subTab] ?? {};

  const set = (key: string, val: any) =>
    setContent(prev => ({ ...prev, [subTab]: { ...(prev[subTab] ?? {}), [key]: val } }));

  const setArrItem = (key: string, idx: number, field: string, val: string) =>
    setContent(prev => {
      const arr = [...(prev[subTab]?.[key] ?? [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, [subTab]: { ...(prev[subTab] ?? {}), [key]: arr } };
    });

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveWebsiteSection(subTab as WebsiteSection, content[subTab] ?? {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-7 h-7 animate-spin text-secondary" />
    </div>
  );

  const groups = ["Page Sections", "Misc Sections"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Changes are live immediately on the public website.</p>
        <a href="/" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Preview Website
        </a>
      </div>

      {groups.map(grp => (
        <div key={grp}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 mb-1">{grp}</p>
          <div className="flex flex-wrap gap-1 bg-muted/40 rounded-xl p-1">
            {SUB_TABS.filter(t => t.group === grp).map(t => (
              <button key={t.key} onClick={() => setSubTab(t.key)}
                className={"flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap " +
                  (subTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <t.icon className="w-3 h-3" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-card rounded-2xl border border-border p-6">
        <AnimatePresence mode="wait">
          <motion.div key={subTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }} className="space-y-5">

            {subTab === "hero" && (<>
              <h3 className="font-bold text-base">Hero Section</h3>
              <Field label="Main Headline" hint="Use \n for a line break.">
                <textarea rows={2} className={inputCls} value={sec.headline ?? ""} onChange={e => set("headline", e.target.value)} />
              </Field>
              <Field label="Subheadline">
                <textarea rows={2} className={inputCls} value={sec.subheadline ?? ""} onChange={e => set("subheadline", e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Primary Button Text">
                  <input className={inputCls} value={sec.cta_primary ?? ""} onChange={e => set("cta_primary", e.target.value)} />
                </Field>
                <Field label="Secondary Button Text">
                  <input className={inputCls} value={sec.cta_secondary ?? ""} onChange={e => set("cta_secondary", e.target.value)} />
                </Field>
              </div>
              <Field label="Location Badge">
                <input className={inputCls} value={sec.badge ?? ""} onChange={e => set("badge", e.target.value)} />
              </Field>
            </>)}

            {subTab === "about" && (<>
              <h3 className="font-bold text-base">About Us Section</h3>
              <Field label="Section Title">
                <input className={inputCls} value={sec.title ?? ""} onChange={e => set("title", e.target.value)} />
              </Field>
              <Field label="Company Story">
                <textarea rows={4} className={inputCls} value={sec.story ?? ""} onChange={e => set("story", e.target.value)} />
              </Field>
              <Field label="Mission Statement">
                <textarea rows={2} className={inputCls} value={sec.mission ?? ""} onChange={e => set("mission", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Founded Year">
                  <input className={inputCls} value={sec.founded_year ?? ""} onChange={e => set("founded_year", e.target.value)} />
                </Field>
                <Field label="Vehicles Washed">
                  <input className={inputCls} value={sec.vehicles_washed ?? ""} onChange={e => set("vehicles_washed", e.target.value)} />
                </Field>
                <Field label="Happy Customers">
                  <input className={inputCls} value={sec.happy_customers ?? ""} onChange={e => set("happy_customers", e.target.value)} />
                </Field>
                <Field label="Areas Served">
                  <input className={inputCls} value={sec.areas_served ?? ""} onChange={e => set("areas_served", e.target.value)} />
                </Field>
              </div>
              <Field label="Values" hint="One per line. Shown as checkmark bullets.">
                <textarea rows={4} className={inputCls}
                  value={(sec.values ?? []).join("\n")}
                  onChange={e => set("values", e.target.value.split("\n").filter(Boolean))} />
              </Field>
            </>)}

            {subTab === "how_it_works" && (<>
              <h3 className="font-bold text-base">How It Works — 3 Steps</h3>
              {(sec.steps ?? [
                { icon:"map-pin", title:"Book Online", desc:"" },
                { icon:"truck", title:"We Come to You", desc:"" },
                { icon:"sparkles", title:"You Shine", desc:"" },
              ]).map((step: any, i: number) => (
                <div key={i} className="bg-muted/40 rounded-xl border border-border p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {i + 1}</p>
                  <Field label="Title">
                    <input className={inputCls} value={step.title ?? ""} onChange={e => setArrItem("steps", i, "title", e.target.value)} />
                  </Field>
                  <Field label="Description">
                    <textarea rows={2} className={inputCls} value={step.desc ?? ""} onChange={e => setArrItem("steps", i, "desc", e.target.value)} />
                  </Field>
                </div>
              ))}
            </>)}

            {subTab === "features" && (<>
              <h3 className="font-bold text-base">Why Oasis Section</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Section Title">
                  <input className={inputCls} value={sec.title ?? ""} onChange={e => set("title", e.target.value)} />
                </Field>
                <Field label="Section Subtitle">
                  <input className={inputCls} value={sec.subtitle ?? ""} onChange={e => set("subtitle", e.target.value)} />
                </Field>
              </div>
              {(sec.items ?? [
                { icon:"map-pin", title:"We Come to You", desc:"" },
                { icon:"shield", title:"Vetted Professionals", desc:"" },
                { icon:"leaf", title:"Eco-Conscious", desc:"" },
                { icon:"clock", title:"On Time, Every Time", desc:"" },
              ]).map((item: any, i: number) => (
                <div key={i} className="bg-muted/40 rounded-xl border border-border p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Card {i + 1}</p>
                  <Field label="Title">
                    <input className={inputCls} value={item.title ?? ""} onChange={e => setArrItem("items", i, "title", e.target.value)} />
                  </Field>
                  <Field label="Description">
                    <textarea rows={2} className={inputCls} value={item.desc ?? ""} onChange={e => setArrItem("items", i, "desc", e.target.value)} />
                  </Field>
                </div>
              ))}
            </>)}

            {subTab === "contact" && (<>
              <h3 className="font-bold text-base">Contact Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone Number">
                  <input className={inputCls} value={sec.phone ?? ""} onChange={e => set("phone", e.target.value)} />
                </Field>
                <Field label="WhatsApp Number">
                  <input className={inputCls} value={sec.whatsapp ?? ""} onChange={e => set("whatsapp", e.target.value)} />
                </Field>
                <Field label="Email Address">
                  <input type="email" className={inputCls} value={sec.email ?? ""} onChange={e => set("email", e.target.value)} />
                </Field>
                <Field label="Physical Address">
                  <input className={inputCls} value={sec.address ?? ""} onChange={e => set("address", e.target.value)} />
                </Field>
                <Field label="Operating Hours">
                  <input className={inputCls} value={sec.operating_hours ?? ""} onChange={e => set("operating_hours", e.target.value)} />
                </Field>
                <Field label="Service Area">
                  <input className={inputCls} value={sec.service_area ?? ""} onChange={e => set("service_area", e.target.value)} />
                </Field>
                <Field label="Instagram URL" hint="Full URL e.g. https://instagram.com/oasis">
                  <input className={inputCls} value={sec.instagram ?? ""} onChange={e => set("instagram", e.target.value)} />
                </Field>
                <Field label="Facebook URL">
                  <input className={inputCls} value={sec.facebook ?? ""} onChange={e => set("facebook", e.target.value)} />
                </Field>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Banking details</strong> are managed in the <em>Settings</em> tab and shown to signed-in customers only.
                </p>
              </div>
            </>)}

            {subTab === "cta_band" && (<>
              <h3 className="font-bold text-base">CTA Banner</h3>
              <p className="text-sm text-muted-foreground">The orange call-to-action strip near the bottom of the page.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Headline (line 1)">
                  <input className={inputCls} value={sec.headline ?? ""} onChange={e => set("headline", e.target.value)} />
                </Field>
                <Field label="Headline (line 2)">
                  <input className={inputCls} value={sec.headline2 ?? ""} onChange={e => set("headline2", e.target.value)} />
                </Field>
              </div>
              <Field label="Body Text">
                <textarea rows={2} className={inputCls} value={sec.body ?? ""} onChange={e => set("body", e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Primary Button Text">
                  <input className={inputCls} value={sec.cta1 ?? ""} onChange={e => set("cta1", e.target.value)} />
                </Field>
                <Field label="Secondary Button Text">
                  <input className={inputCls} value={sec.cta2 ?? ""} onChange={e => set("cta2", e.target.value)} />
                </Field>
              </div>
            </>)}

            {subTab === "reviews_section" && (<>
              <h3 className="font-bold text-base">Reviews Section Heading</h3>
              <p className="text-sm text-muted-foreground">Review content is managed in the Reviews tab. Edit the heading text here.</p>
              <Field label="Section Title">
                <input className={inputCls} value={sec.title ?? ""} onChange={e => set("title", e.target.value)} />
              </Field>
              <Field label="Section Subtitle">
                <input className={inputCls} value={sec.subtitle ?? ""} onChange={e => set("subtitle", e.target.value)} />
              </Field>
            </>)}

            {subTab === "pricing_section" && (<>
              <h3 className="font-bold text-base">Pricing Section Heading</h3>
              <p className="text-sm text-muted-foreground">Plan details are managed in the Subscriptions tab. Edit the heading text here.</p>
              <Field label="Section Title">
                <input className={inputCls} value={sec.title ?? ""} onChange={e => set("title", e.target.value)} />
              </Field>
              <Field label="Section Subtitle">
                <input className={inputCls} value={sec.subtitle ?? ""} onChange={e => set("subtitle", e.target.value)} />
              </Field>
              <Field label="Footer Note" hint="Shown below pricing cards.">
                <input className={inputCls} value={sec.note ?? ""} onChange={e => set("note", e.target.value)} />
              </Field>
            </>)}

            {subTab === "footer" && (<>
              <h3 className="font-bold text-base">Footer</h3>
              <Field label="Brand Tagline" hint="Short description below the logo in the footer.">
                <textarea rows={2} className={inputCls} value={sec.tagline ?? ""} onChange={e => set("tagline", e.target.value)} />
              </Field>
              <Field label="Copyright Text" hint="Year is prepended automatically.">
                <input className={inputCls} value={sec.copyright ?? ""} onChange={e => set("copyright", e.target.value)} />
              </Field>
            </>)}

          </motion.div>
        </AnimatePresence>

        <div className="pt-5 mt-5 border-t border-border flex items-center justify-between gap-4 flex-wrap">
          <div>
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {error}</p>}
            {saved && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                <CheckCircle className="w-4 h-4" /> Saved — live on website now
              </motion.span>
            )}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white hover:opacity-90 disabled:opacity-50 transition"
            style={{ background: "#FF8C00" }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving&hellip;</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
