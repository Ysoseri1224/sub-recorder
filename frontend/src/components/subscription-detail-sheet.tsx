"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pencil,
  Trash2,
  Pause,
  Play,
  Plus,
  Receipt,
  Calendar,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { Subscription, SubscriptionDetail, BillingRecord } from "@/lib/types";
import { BILLING_CYCLES, parseCustomDays, getBillingCycleLabel, getBillingCycleShort } from "@/lib/types";
import { getCycleFormat } from "@/components/settings-page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyCompact, convertCurrency } from "@/lib/currency";
import { getTargetCurrency } from "@/components/settings-page";
import { intToHex, getContrastColor } from "@/lib/color";
import { IconUpload } from "@/components/icon-upload";
import * as api from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

interface Props {
  subscriptionId: string | null;
  onClose: () => void;
  onEdit: (sub: Subscription) => void;
  onRefresh: () => void;
  exchangeRates?: Record<string, number>;
}

export function SubscriptionDetailSheet({
  subscriptionId,
  onClose,
  onEdit,
  onRefresh,
  exchangeRates = {},
}: Props) {
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslations();

  // 暂停/恢复 dialog
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendDate, setSuspendDate] = useState("");
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeDate, setResumeDate] = useState("");

  // 添加/编辑账单记录 dialog
  const [billingOpen, setBillingOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [brStart, setBrStart] = useState("");
  const [brEnd, setBrEnd] = useState("");
  const [brAmount, setBrAmount] = useState("");
  const [brCurrency, setBrCurrency] = useState("");
  const [brCycle, setBrCycle] = useState("__default__");
  const [brCustomEndDate, setBrCustomEndDate] = useState("");
  const [brNotes, setBrNotes] = useState("");
  const [brPaidAt, setBrPaidAt] = useState("");

  const loadDetail = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const d = await api.getSubscription(subscriptionId);
      setDetail(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("detail.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    if (subscriptionId) {
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [subscriptionId, loadDetail]);

  const handleDelete = async () => {
    if (!detail) return;
    if (!confirm(t("detail.delete_confirm").replace("{name}", detail.name))) return;
    try {
      await api.deleteSubscription(detail.id);
      toast.success(t("detail.deleted"));
      onClose();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("detail.delete_failed"));
    }
  };

  const handleSuspend = async () => {
    if (!detail) return;
    try {
      await api.suspendSubscription(detail.id, suspendDate || undefined);
      toast.success(t("suspend.success"));
      setSuspendOpen(false);
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("suspend.failed"));
    }
  };

  const handleResume = async () => {
    if (!detail) return;
    try {
      await api.resumeSubscription(detail.id, resumeDate || undefined);
      toast.success(t("resume.success"));
      setResumeOpen(false);
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("resume.failed"));
    }
  };

  const handleAddBilling = async () => {
    if (!detail) return;
    if (!brStart || !brEnd) {
      toast.error(t("billing.fill_dates"));
      return;
    }
    try {
      // Construct billing_cycle value - use custom_days:XX format if custom
      let effectiveCycle: string | undefined = brCycle === "__default__" ? undefined : (brCycle || undefined);
      if (brCycle === "custom_days" && brCustomEndDate && brStart) {
        const start = new Date(brStart);
        const end = new Date(brCustomEndDate);
        const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        effectiveCycle = `custom_days:${diffDays}`;
      }
      
      if (editingRecord) {
        await api.updateBillingRecord(editingRecord.id, {
          period_start: brStart,
          period_end: brEnd,
          amount: brAmount ? Number(brAmount) : undefined,
          currency: brCurrency || undefined,
          billing_cycle: effectiveCycle,
          notes: brNotes || null,
          paid_at: brPaidAt || null,
        });
        toast.success(t("billing.updated"));
      } else {
        // Calculate exchange rate info for new billing record
        const recordAmount = brAmount ? Number(brAmount) : detail.price;
        const recordCurrency = brCurrency || detail.currency;
        const targetCurrency = getTargetCurrency();
        let convertedAmount: number | undefined;
        let exchangeRate: number | undefined;
        
        console.log('[BillingRecord] Creating with:', {
          recordAmount,
          recordCurrency,
          targetCurrency,
          exchangeRatesAvailable: Object.keys(exchangeRates).length,
          exchangeRates,
        });
        
        // Always save conversion info if currencies differ, even if rates not loaded yet
        if (recordCurrency !== targetCurrency) {
          if (Object.keys(exchangeRates).length > 0) {
            // Use actual exchange rates
            convertedAmount = convertCurrency(recordAmount, recordCurrency, targetCurrency, exchangeRates);
            exchangeRate = convertedAmount / recordAmount;
            console.log('[BillingRecord] Converted:', { convertedAmount, exchangeRate });
          } else {
            // Rates not loaded yet, save placeholder (will show original amount)
            convertedAmount = recordAmount;
            exchangeRate = 1.0;
            console.log('[BillingRecord] No rates, using placeholder');
          }
        } else {
          console.log('[BillingRecord] Same currency, no conversion needed');
        }

        // Save current date as exchange rate date if conversion happened
        const exchangeRateDate = convertedAmount !== undefined ? new Date().toISOString().split('T')[0] : undefined;

        await api.createBillingRecord(detail.id, {
          period_start: brStart,
          period_end: brEnd,
          amount: brAmount ? Number(brAmount) : undefined,
          currency: brCurrency || undefined,
          billing_cycle: effectiveCycle,
          notes: brNotes || null,
          paid_at: brPaidAt || null,
          converted_amount: convertedAmount,
          target_currency: convertedAmount !== undefined ? targetCurrency : undefined,
          exchange_rate: exchangeRate,
          exchange_rate_date: exchangeRateDate,
        });
        toast.success(t("billing.added"));
      }
      setBillingOpen(false);
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("billing.add_failed"));
    }
  };

  const handleDeleteBilling = async (record: BillingRecord) => {
    if (!confirm(t("billing.delete_confirm"))) return;
    try {
      await api.deleteBillingRecord(record.id);
      toast.success(t("detail.deleted"));
      loadDetail();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("billing.delete_failed"));
    }
  };

  const openAddBilling = () => {
    if (!detail) return;
    const today = new Date().toISOString().split("T")[0];
    setEditingRecord(null);
    setBrStart(detail.billing_date);
    setBrEnd(detail.next_bill_date || today);
    setBrAmount("");
    setBrCurrency(detail.currency);
    setBrCycle("__default__");
    setBrCustomEndDate("");
    setBrNotes("");
    setBrPaidAt(today);
    setBillingOpen(true);
  };

  const openEditBilling = (record: BillingRecord) => {
    if (!detail) return;
    setEditingRecord(record);
    setBrStart(record.period_start);
    setBrEnd(record.period_end);
    setBrAmount(String(record.amount));
    setBrCurrency(record.currency);
    // Handle billing_cycle
    if (record.billing_cycle) {
      const parsedDays = parseCustomDays(record.billing_cycle);
      if (parsedDays !== null) {
        setBrCycle("custom_days");
        const bd = new Date(record.period_start);
        bd.setDate(bd.getDate() + parsedDays);
        setBrCustomEndDate(bd.toISOString().split("T")[0]);
      } else {
        setBrCycle(record.billing_cycle);
        setBrCustomEndDate("");
      }
    } else {
      setBrCycle("__default__");
      setBrCustomEndDate("");
    }
    setBrNotes(record.notes || "");
    setBrPaidAt(record.paid_at || "");
    setBillingOpen(true);
  };

  if (!subscriptionId) return null;

  const bgColor = detail ? intToHex(detail.color) : "#6366f1";
  const textColor = getContrastColor(bgColor);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = detail?.end_date ? new Date(detail.end_date) < today : false;

  const tintFilter = detail?.should_be_tinted
    ? textColor === "#000000"
      ? "brightness(0)"
      : "brightness(0) invert(1)"
    : undefined;

  return (
    <>
      <Sheet open={!!subscriptionId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 pb-16 md:pb-0">
          {loading || !detail ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <SheetHeader className="sr-only"><SheetTitle>{t("detail.loading")}</SheetTitle></SheetHeader>
              {t("common.loading")}
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Header with color */}
              <div
                className="p-6 pb-4"
                style={{ backgroundColor: bgColor, color: textColor }}
              >
                <SheetHeader>
                  <div className="flex items-center gap-3">
                    <IconUpload
                      subscriptionId={detail.id}
                      currentIcon={detail.icon}
                      currentMimeType={detail.icon_mime_type}
                      onUpdated={() => { loadDetail(); onRefresh(); }}
                      tintFilter={tintFilter}
                    />
                    <div className="flex-1">
                      <SheetTitle style={{ color: textColor }} className="text-xl">
                        {detail.name}
                      </SheetTitle>
                      <p className="text-sm opacity-80">
                        {detail.is_one_time ? t("sub.one_time") : getBillingCycleLabel(detail.billing_cycle)}
                      </p>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-4 flex items-baseline gap-1 flex-wrap">
                  {(detail.effective_records ?? []).length > 0 ? (
                    <>
                      {detail.effective_records.map((r, i) => {
                        const rCycle = r.billing_cycle || detail.billing_cycle;
                        return (
                          <span key={i} className="text-3xl font-bold">
                            {i > 0 && <span className="text-lg opacity-50 mx-1">+</span>}
                            {formatCurrencyCompact(r.amount, r.currency)}
                            {!detail.is_one_time && (
                              <span className="text-sm font-medium opacity-70">
                                {getBillingCycleShort(rCycle, getCycleFormat())}
                              </span>
                            )}
                          </span>
                        );
                      })}
                      <span className="text-sm opacity-70 ml-2 line-through">
                        {formatCurrencyCompact(detail.price, detail.currency)}
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold">
                      {formatCurrencyCompact(detail.price, detail.currency)}
                      {!detail.is_one_time && (
                        <span className="text-sm font-medium opacity-70">
                          {getBillingCycleShort(detail.billing_cycle, getCycleFormat())}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {detail.is_suspended && (
                  <Badge className="mt-2 bg-white/20 border-0" style={{ color: textColor }}>
                    <Pause className="h-3 w-3 mr-1" />
                    {t("card.suspended")}
                    {detail.suspended_until && ` · ${t("detail.suspended_until")} ${detail.suspended_until}`}
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 p-4 border-b">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(detail as unknown as Subscription)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {t("common.edit")}
                </Button>
                {detail.is_suspended ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setResumeDate(new Date().toISOString().split("T")[0]);
                      setResumeOpen(true);
                    }}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {t("sub.resume")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSuspendDate(new Date().toISOString().split("T")[0]);
                      setSuspendOpen(true);
                    }}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    {t("sub.suspend")}
                  </Button>
                )}
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
                {isExpired ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("detail.next_bill")}</span>
                    <span className="text-sm font-medium text-destructive">{t("detail.expired")}</span>
                  </div>
                ) : (
                  <InfoRow label={t("detail.next_bill")} value={
                    detail.next_bill_date
                      ? new Date(detail.next_bill_date).toLocaleDateString()
                      : detail.is_suspended ? t("card.suspended") : "—"
                  } />
                )}
                <InfoRow label={t("detail.start_date")} value={new Date(detail.billing_date).toLocaleDateString()} />
                {detail.end_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("detail.end_date")}</span>
                    <span className={`text-sm font-medium ${isExpired ? "text-destructive line-through" : ""}`}>
                      {new Date(detail.end_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {detail.notes && <InfoRow label={t("detail.notes")} value={detail.notes} />}
                {detail.link && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("detail.link")}</span>
                    <a
                      href={detail.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center gap-1 hover:underline"
                    >
                      {t("common.open")} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              <Separator />

              {/* Billing Records */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-1.5">
                    <Receipt className="h-4 w-4" />
                    {t("billing.records")}
                  </h3>
                  <Button size="sm" variant="outline" onClick={openAddBilling}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("billing.add")}
                  </Button>
                </div>

                {detail.billing_records.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t("billing.no_records")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.billing_records.map((record) => {
                      const recordExpired = new Date(record.period_end) < today;
                      return (
                      <div
                        key={record.id}
                        className={`flex items-center justify-between rounded-lg border p-3 ${recordExpired ? "opacity-60" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${recordExpired ? "text-muted-foreground" : ""}`}>
                              {formatCurrencyCompact(record.amount, record.currency)}
                            </span>
                            {!detail.is_one_time && (
                              <span className="text-xs text-muted-foreground">
                                {record.billing_cycle ? getBillingCycleLabel(record.billing_cycle) : t("billing.default_cycle")}
                              </span>
                            )}
                            {record.notes && (
                              <span className="text-xs text-muted-foreground">
                                · {record.notes}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {record.period_start} → <span className={recordExpired ? "text-destructive line-through" : ""}>{record.period_end}</span>
                            </p>
                            {record.converted_amount && record.target_currency && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span>≈ {formatCurrencyCompact(record.converted_amount, record.target_currency)}</span>
                                {record.exchange_rate && (
                                  <span className="opacity-70">
                                    ({t("billing.rate")} {record.exchange_rate.toFixed(4)}
                                    {record.exchange_rate_date && ` @ ${record.exchange_rate_date}`})
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditBilling(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteBilling(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 暂停 Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("suspend.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("suspend.desc")}
          </p>
          <div className="grid gap-2">
            <Label>{t("suspend.date")}</Label>
            <Input
              type="date"
              value={suspendDate}
              onChange={(e) => setSuspendDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSuspend}>{t("suspend.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 恢复 Dialog */}
      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("resume.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("resume.desc")}
          </p>
          <div className="grid gap-2">
            <Label>{t("resume.date")}</Label>
            <Input
              type="date"
              value={resumeDate}
              onChange={(e) => setResumeDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleResume}>{t("resume.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加账单记录 Dialog */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRecord ? t("billing.edit_record") : t("billing.add_record")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>{t("billing.period_start")}</Label>
                <Input
                  type="date"
                  value={brStart}
                  onChange={(e) => setBrStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("billing.period_end")}</Label>
                <Input
                  type="date"
                  value={brEnd}
                  onChange={(e) => setBrEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-2">
                <Label>{t("billing.amount_hint")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={brAmount}
                  onChange={(e) => setBrAmount(e.target.value)}
                  placeholder={detail?.price.toString()}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("sub.currency")}</Label>
                <Input
                  value={brCurrency}
                  onChange={(e) => setBrCurrency(e.target.value)}
                  placeholder={detail?.currency}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("billing.cycle_hint")}</Label>
              <div className="flex gap-2">
                <Select value={brCycle} onValueChange={setBrCycle}>
                  <SelectTrigger className={brCycle === "custom_days" ? "w-[120px]" : "w-full"}>
                    <SelectValue placeholder={detail ? getBillingCycleLabel(detail.billing_cycle) : t("common.default")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">{t("common.default")}</SelectItem>
                    {BILLING_CYCLES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`cycle.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {brCycle === "custom_days" && (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      type="date"
                      value={brCustomEndDate}
                      onChange={(e) => setBrCustomEndDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("billing.paid_at")}</Label>
              <Input
                type="date"
                value={brPaidAt}
                onChange={(e) => setBrPaidAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("sub.notes")}</Label>
              <Input
                value={brNotes}
                onChange={(e) => setBrNotes(e.target.value)}
                placeholder={t("billing.notes_hint")}
              />
            </div>
            
            {/* 汇率信息 - 仅在编辑时显示 */}
            {editingRecord && (
              <div className="grid gap-2 p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t("billing.exchange_rate")}</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const recordAmount = brAmount ? Number(brAmount) : editingRecord.amount;
                      const recordCurrency = brCurrency || editingRecord.currency;
                      const targetCurrency = getTargetCurrency();
                      
                      if (recordCurrency === targetCurrency) {
                        toast.info(t("billing.same_currency"));
                        return;
                      }
                      
                      if (Object.keys(exchangeRates).length === 0) {
                        toast.error(t("billing.rate_not_loaded"));
                        return;
                      }
                      
                      const convertedAmount = convertCurrency(recordAmount, recordCurrency, targetCurrency, exchangeRates);
                      const exchangeRate = convertedAmount / recordAmount;
                      const exchangeRateDate = new Date().toISOString().split('T')[0];
                      
                      try {
                        await api.updateBillingRecord(editingRecord.id, {
                          converted_amount: convertedAmount,
                          target_currency: targetCurrency,
                          exchange_rate: exchangeRate,
                          exchange_rate_date: exchangeRateDate,
                        });
                        toast.success(t("billing.rate_updated"));
                        loadDetail();
                        onRefresh();
                        setBillingOpen(false);
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : t("common.error"));
                      }
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {t("billing.fetch_rate")}
                  </Button>
                </div>
                {editingRecord.converted_amount && editingRecord.target_currency && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>{t("billing.converted")}: {formatCurrencyCompact(editingRecord.converted_amount, editingRecord.target_currency)}</div>
                    {editingRecord.exchange_rate && (
                      <div>{t("billing.rate")}: {editingRecord.exchange_rate.toFixed(4)}</div>
                    )}
                    {editingRecord.exchange_rate_date && (
                      <div>{t("billing.rate_date")}: {editingRecord.exchange_rate_date}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAddBilling}>{editingRecord ? t("common.save") : t("billing.add")}</Button>
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
