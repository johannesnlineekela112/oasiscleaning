import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Megaphone, X, Save, Loader2, AlertCircle, Eye, EyeOff,
} from "lucide-react";
import {
  MarketingAd, CreateAdPayload, UpdateAdPayload,
  getAllAds, createAd, updateAd, deleteAd, toggleAdActive,
  emptyAdForm, AD_PLACEMENTS, PLACEMENT_LABELS, isAdCurrentlyActive,
} from "@/lib/adService";

// ─── Local types ──────────────────────────────────────────────────────────────
type ModalMode = "add" | "edit";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function placementBadgeColor(p: MarketingAd["placement"]): string {
  const map: Record<string, string> = {
    banner_top: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    inline:     "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    popup:      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    sidebar:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  };
  return map[p] || "bg-muted text-foreground/70";
}

// ─── Form modal ───────────────────────────────────────────────────────────────
function AdFormModal({
  mode,
  initial,
  onSave,
  onClose,
}: {
  mode:    ModalMode;
  initial: CreateAdPayload;
  onSave:  (payload: CreateAdPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateAdPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof CreateAdPayload, v: unknown) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    if (!form.message.trim()) { setErr("Message is required."); return; }
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      setErr("End date must be on or after start date."); return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 text-foreground placeholder:text-muted-foreground";
  const labelCls = "text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1 block";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card flex items-center justify-between px-5 pt-5 pb-4 border-b border-border z-10">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" style={{ color: "#FF8C00" }} />
            <h3 className="font-display font-bold text-lg">
              {mode === "add" ? "Create Ad" : "Edit Ad"}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Error */}
          {err && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}

          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title}
              placeholder="e.g. Weekend Special — 20% Off"
              onChange={e => { set("title", e.target.value); setErr(""); }} />
          </div>

          {/* Message */}
          <div>
            <label className={labelCls}>Message *</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={form.message}
              placeholder="Short promotional copy shown to customers"
              onChange={e => { set("message", e.target.value); setErr(""); }}
            />
          </div>

          {/* Image URL */}
          <div>
            <label className={labelCls}>Image URL <span className="normal-case font-normal">(optional)</span></label>
            <input className={inputCls} value={form.image_url || ""}
              placeholder="https://example.com/promo.jpg"
              onChange={e => set("image_url", e.target.value || null)} />
            {form.image_url && (
              <img
                src={form.image_url}
                alt="preview"
                className="mt-2 w-full h-28 object-cover rounded-xl border border-border"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Button Text</label>
              <input className={inputCls} value={form.button_text || ""}
                placeholder="Book Now"
                onChange={e => set("button_text", e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>Button Link</label>
              <input className={inputCls} value={form.button_link || ""}
                placeholder="https://... or /#section"
                onChange={e => set("button_link", e.target.value || null)} />
            </div>
          </div>

          {/* Placement + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Placement *</label>
              <select
                className={inputCls}
                value={form.placement}
                onChange={e => set("placement", e.target.value)}
              >
                {AD_PLACEMENTS.map(p => (
                  <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority (0 = highest)</label>
              <input
                type="number" min={0} className={inputCls}
                value={form.priority}
                onChange={e => set("priority", Number(e.target.value))}
              />
            </div>
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date <span className="normal-case font-normal">(blank = immediate)</span></label>
              <input type="date" className={inputCls}
                value={form.start_date || ""}
                onChange={e => set("start_date", e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>End Date <span className="normal-case font-normal">(blank = no expiry)</span></label>
              <input type="date" className={inputCls}
                value={form.end_date || ""}
                onChange={e => set("end_date", e.target.value || null)} />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Active</p>
              <p className="text-xs font-medium text-foreground/70">Toggle off to pause without deleting</p>
            </div>
            <button
              type="button"
              onClick={() => set("active", !form.active)}
              className="transition"
            >
              {form.active
                ? <ToggleRight className="w-8 h-8 text-green-500" />
                : <ToggleLeft  className="w-8 h-8 text-foreground/40" />
              }
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            style={{ background: "#FF8C00" }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Ad</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main AdminAds component ──────────────────────────────────────────────────
const AdminAds = () => {
  const [ads,     setAds]     = useState<MarketingAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [modal,   setModal]   = useState<{ mode: ModalMode; ad?: MarketingAd } | null>(null);

  const notify = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(""), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllAds();
      setAds(data);
    } catch (e: any) {
      notify(e?.message || "Failed to load ads", "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const handleCreate = async (payload: CreateAdPayload) => {
    await createAd(payload);
    await load();
    notify("✓ Ad created successfully.");
  };

  const handleUpdate = (ad: MarketingAd) => async (payload: CreateAdPayload) => {
    await updateAd(ad.id, payload as UpdateAdPayload);
    await load();
    notify("✓ Ad updated.");
  };

  const handleToggle = async (ad: MarketingAd) => {
    try {
      await toggleAdActive(ad.id, !ad.active);
      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, active: !a.active } : a));
      notify(`Ad ${ad.active ? "deactivated" : "activated"}.`);
    } catch (e: any) {
      notify(e?.message || "Toggle failed.", "err");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this ad?")) return;
    try {
      await deleteAd(id);
      setAds(prev => prev.filter(a => a.id !== id));
      notify("Ad deleted.");
    } catch (e: any) {
      notify(e?.message || "Delete failed.", "err");
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const live    = ads.filter(isAdCurrentlyActive).length;
  const paused  = ads.filter(a => !a.active).length;
  const total   = ads.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl flex items-center gap-2">
            <Megaphone className="w-5 h-5" style={{ color: "#FF8C00" }} />
            Marketing Ads
          </h2>
          <p className="text-xs font-medium text-foreground/80 mt-0.5">
            Create and schedule promotional banners, inline cards, popups, and sidebar panels.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
          style={{ background: "#FF8C00" }}
        >
          <Plus className="w-4 h-4" /> New Ad
        </button>
      </div>

      {/* Quick stats — only shown once data has loaded */}
      {!loading && (
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total",  value: total,  color: "text-foreground",   bg: "bg-muted/60" },
          { label: "Live",   value: live,   color: "text-green-600",    bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Paused", value: paused, color: "text-foreground/80",bg: "bg-muted/40" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 text-center border border-border`}>
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-bold text-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      )}

      {/* Feedback toast */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${
              msgType === "err"
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-green-500/10 border-green-500/30 text-green-600"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" /> {msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-secondary" />
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-foreground">No ads yet</p>
            <p className="text-sm mt-1 text-foreground/70">Click <strong>New Ad</strong> to create your first promotion.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["", "Title", "Placement", "Schedule", "Priority", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ads.map(ad => {
                  const currently = isAdCurrentlyActive(ad);
                  return (
                    <tr
                      key={ad.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-3 w-12">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-foreground/40" />
                          </div>
                        )}
                      </td>

                      {/* Title + message */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-semibold truncate text-foreground">{ad.title}</p>
                        <p className="text-xs text-foreground/70 font-medium truncate">{ad.message}</p>
                      </td>

                      {/* Placement badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${placementBadgeColor(ad.placement)}`}>
                          {PLACEMENT_LABELS[ad.placement].split("—")[0].trim()}
                        </span>
                      </td>

                      {/* Schedule */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-foreground font-medium">
                        <div>{ad.start_date ? `From ${ad.start_date}` : <span className="text-green-600 font-semibold">Immediate</span>}</div>
                        <div>{ad.end_date   ? `Until ${ad.end_date}`  : <span className="text-foreground/60">No expiry</span>}</div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-mono font-bold text-foreground/80">{ad.priority}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                          currently
                            ? "bg-green-500/15 text-green-500"
                            : ad.active
                            ? "bg-yellow-500/15 text-yellow-500"
                            : "bg-muted text-foreground/60"
                        }`}>
                          {currently ? <><Eye className="w-3 h-3" /> Live</> : ad.active ? "Scheduled" : <><EyeOff className="w-3 h-3" /> Paused</>}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Toggle */}
                          <button
                            onClick={() => handleToggle(ad)}
                            title={ad.active ? "Deactivate" : "Activate"}
                            className="p-1.5 rounded-lg hover:bg-muted transition text-foreground/60 hover:text-foreground"
                          >
                            {ad.active
                              ? <ToggleRight className="w-5 h-5 text-green-500" />
                              : <ToggleLeft  className="w-5 h-5" />
                            }
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setModal({ mode: "edit", ad })}
                            className="p-1.5 rounded-lg hover:bg-muted transition text-foreground/60 hover:text-foreground"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(ad.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {modal && (
          <AdFormModal
            key={modal.ad?.id ?? "new"}
            mode={modal.mode}
            initial={modal.mode === "edit" && modal.ad
              ? {
                  title:       modal.ad.title,
                  message:     modal.ad.message,
                  image_url:   modal.ad.image_url,
                  button_text: modal.ad.button_text,
                  button_link: modal.ad.button_link,
                  placement:   modal.ad.placement,
                  active:      modal.ad.active,
                  start_date:  modal.ad.start_date,
                  end_date:    modal.ad.end_date,
                  priority:    modal.ad.priority,
                }
              : emptyAdForm()
            }
            onSave={modal.mode === "edit" && modal.ad
              ? handleUpdate(modal.ad)
              : handleCreate
            }
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAds;
