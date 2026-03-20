/**
 * WebsiteManager.tsx
 *
 * Admin panel for editing all public-facing website content.
 * Lives inside the AdminDashboard under the "Website" tab.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Loader2, CheckCircle, Globe, ImageIcon, Info, Phone, Users } from "lucide-react";
import { getAllWebsiteContent, saveWebsiteSection, type WebsiteSection } from "@/lib/websiteService";

type SubTab = "hero" | "about" | "contact" | "how_it_works";

const SUB_TABS: { key: SubTab; label: string; icon: any }[] = [
  { key: "hero",         label: "Hero",          icon: Globe },
  { key: "about",        label: "About Us",      icon: Users },
  { key: "contact",      label: "Contact",       icon: Phone },
  { key: "how_it_works", label: "How It Works",  icon: Info },
];

export function WebsiteManager() {
  const [subTab,    setSubTab]    = useState<SubTab>("hero");
  const [content,   setContent]   = useState<Record<string, any>>({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAllWebsiteContent()
      .then(setContent)
      .catch(() => setError("Failed to load website content"))
      .finally(() => setLoading(false));
  }, []);

  const update = (section: string, key: string, value: any) => {
    setContent(prev => ({
      ...prev,
      [section]: { ...(prev[section] ?? {}), [key]: value },
    }));
  };

  const updateArrayItem = (section: string, key: string, idx: number, field: string, value: string) => {
    setContent(prev => {
      const arr = [...(prev[section]?.[key] ?? [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [section]: { ...(prev[section] ?? {}), [key]: arr } };
    });
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveWebsiteSection(subTab as WebsiteSection, content[subTab] ?? {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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

  const section = content[subTab] ?? {};

  return (
    <div className="space-y-5">
      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-muted/60 rounded-xl p-1 w-fit overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
              subTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        {/* ── HERO ── */}
        {subTab === "hero" && (
          <>
            <h3 className="font-bold text-lg">Hero Section</h3>
            <p className="text-sm text-muted-foreground">The first thing visitors see. Keep it punchy.</p>
            <Field label="Main Headline" hint='Use \\n for line break. e.g. "WE COME.\\nYOU SHINE."'>
              <textarea rows={2} className={inputCls}
                value={section.headline ?? ""}
                onChange={e => update("hero", "headline", e.target.value)} />
            </Field>
            <Field label="Subheadline">
              <textarea rows={2} className={inputCls}
                value={section.subheadline ?? ""}
                onChange={e => update("hero", "subheadline", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Primary CTA Button Text">
                <input className={inputCls} value={section.cta_primary ?? ""} onChange={e => update("hero", "cta_primary", e.target.value)} />
              </Field>
              <Field label="Secondary CTA Button Text">
                <input className={inputCls} value={section.cta_secondary ?? ""} onChange={e => update("hero", "cta_secondary", e.target.value)} />
              </Field>
            </div>
            <Field label="Location Badge">
              <input className={inputCls} value={section.badge ?? ""} onChange={e => update("hero", "badge", e.target.value)} />
            </Field>
          </>
        )}

        {/* ── ABOUT ── */}
        {subTab === "about" && (
          <>
            <h3 className="font-bold text-lg">About Us Section</h3>
            <Field label="Section Title">
              <input className={inputCls} value={section.title ?? ""} onChange={e => update("about", "title", e.target.value)} />
            </Field>
            <Field label="Company Story">
              <textarea rows={4} className={inputCls}
                value={section.story ?? ""}
                onChange={e => update("about", "story", e.target.value)} />
            </Field>
            <Field label="Mission Statement">
              <textarea rows={2} className={inputCls}
                value={section.mission ?? ""}
                onChange={e => update("about", "mission", e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Founded Year">
                <input className={inputCls} value={section.founded_year ?? ""} onChange={e => update("about", "founded_year", e.target.value)} />
              </Field>
              <Field label="Vehicles Washed">
                <input className={inputCls} value={section.vehicles_washed ?? ""} onChange={e => update("about", "vehicles_washed", e.target.value)} />
              </Field>
              <Field label="Happy Customers">
                <input className={inputCls} value={section.happy_customers ?? ""} onChange={e => update("about", "happy_customers", e.target.value)} />
              </Field>
            </div>
            <Field label="Areas Served">
              <input className={inputCls} value={section.areas_served ?? ""} onChange={e => update("about", "areas_served", e.target.value)} />
            </Field>
            <Field label="Values (one per line)">
              <textarea rows={4} className={inputCls}
                value={(section.values ?? []).join("\n")}
                onChange={e => update("about", "values", e.target.value.split("\n").filter(Boolean))} />
            </Field>
          </>
        )}

        {/* ── CONTACT ── */}
        {subTab === "contact" && (
          <>
            <h3 className="font-bold text-lg">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone Number">
                <input className={inputCls} value={section.phone ?? ""} onChange={e => update("contact", "phone", e.target.value)} />
              </Field>
              <Field label="WhatsApp Number">
                <input className={inputCls} value={section.whatsapp ?? ""} onChange={e => update("contact", "whatsapp", e.target.value)} />
              </Field>
              <Field label="Email Address">
                <input type="email" className={inputCls} value={section.email ?? ""} onChange={e => update("contact", "email", e.target.value)} />
              </Field>
              <Field label="Physical Address">
                <input className={inputCls} value={section.address ?? ""} onChange={e => update("contact", "address", e.target.value)} />
              </Field>
              <Field label="Operating Hours">
                <input className={inputCls} value={section.operating_hours ?? ""} onChange={e => update("contact", "operating_hours", e.target.value)} />
              </Field>
              <Field label="Service Area Description">
                <input className={inputCls} value={section.service_area ?? ""} onChange={e => update("contact", "service_area", e.target.value)} />
              </Field>
              <Field label="Instagram URL" hint="Full URL e.g. https://instagram.com/oasis">
                <input className={inputCls} value={section.instagram ?? ""} onChange={e => update("contact", "instagram", e.target.value)} />
              </Field>
              <Field label="Facebook URL">
                <input className={inputCls} value={section.facebook ?? ""} onChange={e => update("contact", "facebook", e.target.value)} />
              </Field>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Banking details</strong> are managed in the <em>Settings</em> tab under "Banking Details". Changes there automatically appear on the website.
              </p>
            </div>
          </>
        )}

        {/* ── HOW IT WORKS ── */}
        {subTab === "how_it_works" && (
          <>
            <h3 className="font-bold text-lg">How It Works — 3 Steps</h3>
            <p className="text-sm text-muted-foreground">Edit the three process steps shown on the website.</p>
            {(section.steps ?? [
              { icon: "map-pin", title: "Book Online",    desc: "" },
              { icon: "truck",   title: "We Come to You", desc: "" },
              { icon: "sparkles",title: "You Shine",      desc: "" },
            ]).map((step: any, i: number) => (
              <div key={i} className="bg-muted/40 rounded-xl border border-border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {i + 1}</p>
                <Field label="Title">
                  <input className={inputCls} value={step.title ?? ""} onChange={e => updateArrayItem("how_it_works", "steps", i, "title", e.target.value)} />
                </Field>
                <Field label="Description">
                  <textarea rows={2} className={inputCls}
                    value={step.desc ?? ""}
                    onChange={e => updateArrayItem("how_it_works", "steps", i, "desc", e.target.value)} />
                </Field>
              </div>
            ))}
          </>
        )}

        {/* Save bar */}
        <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
              <CheckCircle className="w-4 h-4" /> Saved successfully
            </motion.span>
          )}
          {!error && !saved && <span />}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "#FF8C00" }}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> Changes are live immediately. Visit{" "}
          <a href="/" target="_blank" rel="noreferrer" className="underline font-semibold">the website</a>{" "}
          in a new tab to preview your changes.
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}
