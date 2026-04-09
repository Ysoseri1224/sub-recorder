"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, ExternalLink, Layers } from "lucide-react";
import { IconUpload } from "@/components/icon-upload";
import type { SceneWithSummary } from "@/lib/types";
import { cycleToMonths, getBillingCycleShort } from "@/lib/types";
import { PRESET_COLORS, intToHex, hexToInt, getContrastColor } from "@/lib/color";
import { getCycleFormat, getTargetCurrency, getNormalizeCycle } from "@/components/settings-page";
import { formatCurrencyCompact, convertCurrency } from "@/lib/currency";
import * as api from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

interface Props {
  scene: SceneWithSummary | null;
  onClose: () => void;
  onRefresh: () => void;
  onNavigate: () => void;
  exchangeRates?: Record<string, number>;
}

export function SceneDetailSheet({ scene, onClose, onRefresh, onNavigate, exchangeRates = {} }: Props) {
  const { t } = useTranslations();
  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editColor, setEditColor] = useState("#6366f1");
  const [editNotes, setEditNotes] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [editIconMime, setEditIconMime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    if (!scene) return;
    setEditColor(scene.color ? intToHex(scene.color) : "#ffffff");
    setEditNotes(scene.notes ?? "");
    setEditLink(scene.link ?? "");
    setEditIcon(scene.icon ?? null);
    setEditIconMime(scene.icon_mime_type ?? null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!scene) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        color: hexToInt(editColor),
        notes: editNotes.trim() || null,
        link: editLink.trim() || null,
      };
      if (editIcon !== (scene.icon ?? null)) {
        data.icon = editIcon;
        data.icon_mime_type = editIconMime || "image/png";
      }
      await api.updateScene(scene.id, data);
      toast.success(t("scene.updated"));
      setEditOpen(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("scene.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!scene) return;
    if (!confirm(t("scene.delete_scene"))) return;
    try {
      await api.deleteScene(scene.id);
      toast.success(t("scene.deleted"));
      onClose();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("scene.delete_failed"));
    }
  };


  if (!scene) return null;

  const bgColor = scene.color ? intToHex(scene.color) : "#ffffff";
  const textColor = getContrastColor(bgColor);

  const normSetting = getNormalizeCycle();
  const displayCycleName = normSetting !== "auto" ? normSetting : scene.billing_cycle;
  const displayCurrency = getTargetCurrency();
  const displayMonths = cycleToMonths(displayCycleName);
  const convertedTotal = scene.sub_previews.reduce((sum, p) => {
    // Skip expired and suspended
    if (p.is_expired || p.is_suspended) return sum;

    const records = p.effective_records ?? [];
    if (records.length > 0) {
      // Use effective records for price
      return sum + records.reduce((s, r) => {
        const months = cycleToMonths(r.billing_cycle || p.billing_cycle);
        const monthly = convertCurrency(r.amount, r.currency, displayCurrency, exchangeRates) / months;
        return s + monthly * displayMonths;
      }, 0);
    }
    // Fallback to base price
    const price = p.price ?? 0;
    const currency = p.currency ?? "CNY";
    const subMonths = cycleToMonths(p.billing_cycle);
    const monthly = price / subMonths;
    const normalized = monthly * displayMonths;
    return sum + convertCurrency(normalized, currency, displayCurrency, exchangeRates);
  }, 0);

  const nextDateStr = scene.nearest_next_bill
    ? new Date(scene.nearest_next_bill).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  return (
    <>
      <Sheet open={!!scene} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 pb-16 md:pb-0">
          <div className="flex flex-col">
            {/* Colored header — matching subscription detail sheet */}
            <div className="p-6 pb-4" style={{ backgroundColor: bgColor, color: textColor }}>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                    {scene.icon ? (
                      <img
                        src={`data:${scene.icon_mime_type || "image/png"};base64,${scene.icon}`}
                        alt={scene.name}
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <Layers className="h-6 w-6" style={{ color: textColor }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <SheetTitle style={{ color: textColor }} className="text-xl">
                      {scene.name}
                    </SheetTitle>
                    <p className="text-sm opacity-80">
                      {scene.sub_count}{t("scene.items")}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {formatCurrencyCompact(convertedTotal, displayCurrency)}
                  <span className="text-sm font-medium opacity-70">
                    {getBillingCycleShort(displayCycleName, getCycleFormat())}
                  </span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 border-b">
              <Button size="sm" variant="outline" onClick={openEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                {t("common.edit")}
              </Button>
              <Button size="sm" variant="outline" onClick={onNavigate}>
                <Layers className="h-4 w-4 mr-1" />
                {t("scene.enter")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive ml-auto"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              {nextDateStr && (
                <InfoRow label={t("scene.nearest_bill")} value={nextDateStr} />
              )}
              {scene.notes && <InfoRow label={t("sub.notes")} value={scene.notes} />}
              {scene.link && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("sub.link")}</span>
                  <a
                    href={scene.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary flex items-center gap-1 hover:underline"
                  >
                    {t("scene.open_link")} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <Separator />

            {/* Sub-items list (like billing records) */}
            <div className="p-4">
              <h3 className="font-semibold flex items-center gap-1.5 mb-3">
                <Layers className="h-4 w-4" />
                {t("scene.items_list")}
              </h3>

              {scene.sub_previews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("scene.no_items")}
                </p>
              ) : (
                <div className="space-y-2">
                  {scene.sub_previews.map((p, i) => {
                    // Use effective_records if available
                    const records = p.effective_records ?? [];
                    let converted: number;
                    if (records.length > 0) {
                      // Sum all effective records normalized to scene cycle
                      converted = records.reduce((s, r) => {
                        const months = cycleToMonths(r.billing_cycle || p.billing_cycle);
                        const monthly = convertCurrency(r.amount, r.currency, displayCurrency, exchangeRates) / months;
                        return s + monthly * displayMonths;
                      }, 0);
                    } else {
                      // Fallback to base price
                      const price = p.price ?? 0;
                      const currency = p.currency ?? "CNY";
                      const subMonths = cycleToMonths(p.billing_cycle);
                      const monthly = price / subMonths;
                      const normalized = monthly * displayMonths;
                      converted = convertCurrency(normalized, currency, displayCurrency, exchangeRates);
                    }
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-lg border p-3 ${p.is_expired || p.is_suspended ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                            {p.icon ? (
                              <img
                                src={`data:${p.icon_mime_type || "image/png"};base64,${p.icon}`}
                                alt={p.name}
                                className="h-6 w-6 object-contain"
                              />
                            ) : (
                              <span className="text-xs font-bold text-muted-foreground">
                                {p.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          {p.is_expired && (
                            <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">{t("card.expired")}</span>
                          )}
                          {p.is_suspended && !p.is_expired && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded">{t("card.suspended")}</span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {p.is_expired ? (
                            <span className="text-sm text-muted-foreground">{t("card.expired")}</span>
                          ) : (
                            <>
                              <span className="text-sm font-medium">
                                {formatCurrencyCompact(converted, displayCurrency)}
                              </span>
                              <span className="text-xs text-muted-foreground ml-0.5">
                                {getBillingCycleShort(displayCycleName, getCycleFormat())}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit dialog — only color, logo, notes, link */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("scene.edit")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Color */}
            <div className="grid gap-2">
              <Label>{t("scene.color_label")}</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-8 w-8 rounded-full border transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: editColor === c ? "white" : "rgba(0,0,0,0.15)",
                      boxShadow: editColor === c ? `0 0 0 2px ${c}` : "none",
                    }}
                    onClick={() => setEditColor(c)}
                  />
                ))}
                <label className="h-8 w-8 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform overflow-hidden relative">
                  <span className="text-xs text-muted-foreground">+</span>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-6 w-6 rounded border" style={{ backgroundColor: editColor }} />
                <span className="text-xs text-muted-foreground font-mono">{editColor.toUpperCase()}</span>
              </div>
            </div>

            {/* Icon */}
            <div className="grid gap-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <IconUpload
                  currentIcon={editIcon}
                  currentMimeType={editIconMime}
                  onUpdated={(newIcon, newMime) => {
                    if (newIcon && newMime) {
                      setEditIcon(newIcon);
                      setEditIconMime(newMime);
                    }
                  }}
                />
                {editIcon && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditIcon(null); setEditIconMime(null); }}
                  >
                    {t("common.clear")}
                  </Button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label>{t("sub.notes")}</Label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={t("scene.notes_hint")}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              />
            </div>

            {/* Link */}
            <div className="grid gap-2">
              <Label>{t("sub.link")}</Label>
              <Input
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                placeholder="https://..."
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
