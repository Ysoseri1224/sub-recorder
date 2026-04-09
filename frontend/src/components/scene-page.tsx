"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Settings2, Trash2, Layers, ArrowUpDown, CheckSquare, Square, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SceneWithSummary, SceneDetail, Subscription, Category } from "@/lib/types";
import { BILLING_CYCLES, getBillingCycleShort, cycleToMonths } from "@/lib/types";
import { getCycleFormat, getTargetCurrency, getNormalizeCycle } from "@/components/settings-page";
import { formatCurrencyCompact, convertCurrency } from "@/lib/currency";
import { SubscriptionCard } from "@/components/subscription-card";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import { SubscriptionDetailSheet } from "@/components/subscription-detail-sheet";
import * as api from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

interface Props {
  scenes: SceneWithSummary[];
  categories: Category[];
  onBack: () => void;
  onRefresh: () => void;
  initialSceneId?: string | null;
  exchangeRates: Record<string, number>;
}

export function ScenePage({ scenes, categories, onBack, onRefresh, initialSceneId, exchangeRates }: Props) {
  const { t } = useTranslations();
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(initialSceneId ?? scenes[0]?.id ?? null);
  const [detail, setDetail] = useState<SceneDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Sub dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [detailSubId, setDetailSubId] = useState<string | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<"billing_date" | "name" | "price_high" | "price_low">("billing_date");

  // Multi-select mode for releasing subscriptions
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Scene settings dialog
  const [sceneSettingsOpen, setSceneSettingsOpen] = useState(false);
  const [sceneName, setSceneName] = useState("");
  const [sceneCycle, setSceneCycle] = useState("month_1");
  const [sceneShowLogos, setSceneShowLogos] = useState(true);

  // Create scene dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newSceneName, setNewSceneName] = useState("");
  const [newSceneCycle, setNewSceneCycle] = useState("month_1");

  const loadDetail = useCallback(async () => {
    if (!currentSceneId) return;
    setLoading(true);
    try {
      const d = await api.getScene(currentSceneId);
      setDetail(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("detail.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [currentSceneId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const refresh = () => {
    loadDetail();
    onRefresh();
  };

  const currentScene = scenes.find(s => s.id === currentSceneId);
  const today = useMemo(() => new Date(), []);

  // Helper to compute subscription monthly CNY
  const subMonthlyCNY = useCallback((sub: Subscription) => {
    const records = sub.effective_records ?? [];
    if (records.length > 0) {
      return records.reduce((sum, r) => {
        const months = cycleToMonths(r.billing_cycle || sub.billing_cycle);
        return sum + convertCurrency(r.amount, r.currency, "CNY", exchangeRates) / months;
      }, 0);
    }
    return convertCurrency(sub.price, sub.currency, "CNY", exchangeRates) / cycleToMonths(sub.billing_cycle);
  }, [exchangeRates]);

  // Sorted subscriptions with expired at bottom
  const sortedSubs = useMemo(() => {
    if (!detail) return [];
    const list = [...detail.subscriptions];
    const isExpired = (s: Subscription) => s.end_date ? new Date(s.end_date) < today : false;

    list.sort((a, b) => {
      // Expired always at bottom
      const ae = isExpired(a);
      const be = isExpired(b);
      if (ae !== be) return ae ? 1 : -1;

      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name, "zh-CN");
          break;
        case "billing_date": {
          const aDate = a.next_bill_date || "9999-12-31";
          const bDate = b.next_bill_date || "9999-12-31";
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case "price_high":
          cmp = subMonthlyCNY(b) - subMonthlyCNY(a);
          break;
        case "price_low":
          cmp = subMonthlyCNY(a) - subMonthlyCNY(b);
          break;
      }
      return cmp;
    });
    return list;
  }, [detail, sortBy, today, subMonthlyCNY]);

  // Compute total for the scene using effective_records + currency conversion
  const targetCurrency = getTargetCurrency();
  const normSetting = getNormalizeCycle();
  const displayCycleName = normSetting !== "auto" ? normSetting : (currentScene?.billing_cycle ?? "month_1");
  const displayMonths = cycleToMonths(displayCycleName);
  const totalNormalized = useMemo(() => {
    if (!detail) return 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    return detail.subscriptions.reduce((sum, sub) => {
      // Skip expired and suspended
      if (sub.end_date && sub.end_date < todayStr) return sum;
      if (sub.is_suspended) return sum;
      const records = sub.effective_records ?? [];
      if (records.length > 0) {
        // Use effective records
        return sum + records.reduce((s, r) => {
          const months = cycleToMonths(r.billing_cycle || sub.billing_cycle);
          const monthly = convertCurrency(r.amount, r.currency, targetCurrency, exchangeRates) / months;
          return s + monthly * displayMonths;
        }, 0);
      }
      // Fallback to base price
      const months = cycleToMonths(sub.billing_cycle);
      const monthly = convertCurrency(sub.price, sub.currency, targetCurrency, exchangeRates) / months;
      return sum + monthly * displayMonths;
    }, 0);
  }, [detail, exchangeRates, targetCurrency, displayMonths]);

  const handleCreateScene = async () => {
    if (!newSceneName.trim()) {
      toast.error(t("scene.name"));
      return;
    }
    try {
      const scene = await api.createScene({
        name: newSceneName.trim(),
        billing_cycle: newSceneCycle,
      });
      toast.success(t("scene.saved"));
      setCreateOpen(false);
      setNewSceneName("");
      onRefresh();
      setCurrentSceneId(scene.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("scene.save_failed"));
    }
  };

  const handleUpdateScene = async () => {
    if (!currentSceneId) return;
    try {
      await api.updateScene(currentSceneId, {
        name: sceneName,
        billing_cycle: sceneCycle,
        show_sub_logos: sceneShowLogos,
      });
      toast.success(t("scene.saved"));
      setSceneSettingsOpen(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("scene.save_failed"));
    }
  };

  const handleDeleteScene = async () => {
    if (!currentSceneId) return;
    if (!confirm(t("scene.delete_confirm").replace("{name}", currentScene?.name ?? ""))) return;
    try {
      await api.deleteScene(currentSceneId);
      toast.success(t("scene.deleted"));
      onRefresh();
      const remaining = scenes.filter(s => s.id !== currentSceneId);
      if (remaining.length > 0) {
        setCurrentSceneId(remaining[0].id);
      } else {
        onBack();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("scene.delete_failed"));
    }
  };

  const openSceneSettings = () => {
    if (!currentScene) return;
    setSceneName(currentScene.name);
    setSceneCycle(currentScene.billing_cycle);
    setSceneShowLogos(currentScene.show_sub_logos);
    setSceneSettingsOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!detail) return;
    setSelectedIds(new Set(detail.subscriptions.map(s => s.id)));
  };

  const releaseSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t("scene.move_out"))) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api.updateSubscription(id, { scene_id: null }))
      );
      toast.success(`${t("scene.batch_moved")} ${selectedIds.size}`);
      setSelectedIds(new Set());
      setSelectMode(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("scene.batch_move_failed"));
    }
  };

  const batchSetShowOnMain = async (value: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api.updateSubscription(id, { show_on_main: value }))
      );
      toast.success(t("settings.save_ok"));
      setSelectedIds(new Set());
      setSelectMode(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // No scenes exist — show empty state with create prompt
  if (scenes.length === 0 && !loading) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-bold font-['MiSans'] mb-2">{t("scene.no_scenes")}</h2>
            <p className="text-muted-foreground mb-6 text-sm break-words whitespace-normal">
              {t("scene.create_first")}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t("scene.add")}
            </Button>
          </div>
        </div>

        {/* Create scene dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("scene.create")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>{t("scene.name")}</Label>
                <Input
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  placeholder={t("scene.name")}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("sub.billing_cycle")}</Label>
                <Select value={newSceneCycle} onValueChange={setNewSceneCycle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.filter(c => c !== "custom_days").map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`cycle.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCreateScene}>{t("sub.create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6">
            {/* Header */}
            <div className="mb-4 md:mb-6 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold font-['MiSans'] truncate">
                  {currentScene?.name ?? t("scene.select")}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
                  {detail?.subscriptions.length ?? 0} {t("scene.subscriptions")}
                  {totalNormalized > 0 && ` · ${t("scene.total")} ${formatCurrencyCompact(totalNormalized, targetCurrency)}${getBillingCycleShort(displayCycleName, getCycleFormat())}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Mobile scene selector */}
                <Select value={currentSceneId ?? ""} onValueChange={setCurrentSceneId}>
                  <SelectTrigger className="md:hidden w-auto min-w-0 max-w-[120px] h-10">
                    <SelectValue placeholder={t("scene.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {scenes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Sort dropdown */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-auto h-10 gap-1">
                    <ArrowUpDown className="h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing_date">{t("sort.date_asc")}</SelectItem>
                    <SelectItem value="name">{t("sort.name_asc")}</SelectItem>
                    <SelectItem value="price_high">{t("sort.price_desc")}</SelectItem>
                    <SelectItem value="price_low">{t("sort.price_asc")}</SelectItem>
                  </SelectContent>
                </Select>
                {/* Select mode / batch actions */}
                {!selectMode ? (
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full h-10 w-10"
                    onClick={() => setSelectMode(true)}
                    title={t("scene.batch_move")}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={selectAll}>{t("scene.select_all")}</Button>
                    <Button size="sm" variant="outline" onClick={() => batchSetShowOnMain(true)} disabled={selectedIds.size === 0}>
                      {t("sub.show_on_main")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => batchSetShowOnMain(false)} disabled={selectedIds.size === 0}>
                      {t("scene.deselect_all")}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={releaseSelected} disabled={selectedIds.size === 0}>
                      {t("scene.batch_move")} ({selectedIds.size})
                    </Button>
                    <Button size="sm" variant="ghost" onClick={exitSelectMode}>{t("common.cancel")}</Button>
                  </>
                )}
                <Button size="icon" variant="outline" className="rounded-full h-10 w-10" onClick={openSceneSettings}>
                  <Settings2 className="h-4 w-4" />
                </Button>
                {!selectMode && (
                  <Button
                    size="icon"
                    className="rounded-xl h-10 w-10 md:h-12 md:w-12 shadow-lg"
                    onClick={() => {
                      setEditingSub(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-5 w-5 md:h-6 md:w-6" />
                  </Button>
                )}
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : !detail || detail.subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p>{t("scene.no_subs")}</p>
                <p className="text-sm">{t("scene.add_first")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 md:gap-3">
                {sortedSubs.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2">
                    {selectMode && (
                      <button
                        onClick={() => toggleSelect(sub.id)}
                        className="shrink-0 p-1"
                      >
                        {selectedIds.has(sub.id) ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <SubscriptionCard
                        subscription={sub}
                        onClick={() => selectMode ? toggleSelect(sub.id) : setDetailSubId(sub.id)}
                        exchangeRates={exchangeRates}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Right sidebar: scene list */}
        <div className="hidden md:block w-60 shrink-0 border-l bg-muted/10 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-3">{t("scene.select")}</h3>
            <div className="space-y-1">
              {scenes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSceneId(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    s.id === currentSceneId
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <div className="font-medium truncate">{s.name}</div>
                  <div className={`text-xs ${s.id === currentSceneId ? "opacity-80" : "text-muted-foreground"}`}>
                    {s.sub_count} {t("scene.subs")}
                  </div>
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("scene.add")}
            </Button>
          </div>
        </div>
      </div>

      {/* Create/Edit subscription dialog */}
      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={editingSub}
        categories={categories}
        scenes={scenes}
        defaultSceneId={currentSceneId}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />

      {/* Detail sheet */}
      <SubscriptionDetailSheet
        subscriptionId={detailSubId}
        onClose={() => setDetailSubId(null)}
        onEdit={(sub) => {
          setDetailSubId(null);
          setEditingSub(sub);
          setDialogOpen(true);
        }}
        onRefresh={refresh}
        exchangeRates={exchangeRates}
      />

      {/* Scene settings dialog */}
      <Dialog open={sceneSettingsOpen} onOpenChange={setSceneSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("scene.settings")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("scene.name")}</Label>
              <Input value={sceneName} onChange={(e) => setSceneName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("sub.billing_cycle")}</Label>
              <Select value={sceneCycle} onValueChange={setSceneCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.filter(c => c !== "custom_days").map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`cycle.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLogos"
                checked={sceneShowLogos}
                onChange={(e) => setSceneShowLogos(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="showLogos">{t("sub.show_on_main")}</Label>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={handleDeleteScene}>
              <Trash2 className="h-4 w-4 mr-1" />
              {t("common.delete")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSceneSettingsOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleUpdateScene}>{t("common.save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create scene dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("scene.create")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("scene.name")}</Label>
              <Input
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                placeholder={t("scene.name")}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("sub.billing_cycle")}</Label>
              <Select value={newSceneCycle} onValueChange={setNewSceneCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.filter(c => c !== "custom_days").map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`cycle.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreateScene}>{t("sub.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
