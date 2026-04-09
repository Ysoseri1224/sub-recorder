"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, RotateCcw, Server, RefreshCw, LogOut, Download, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CURRENCIES, getSymbol, getCurrencyConfig, fetchExchangeRates, getCurrentExchangeRates, clearExchangeRatesCache } from "@/lib/currency";
import { clearAuthToken, getAuthToken, getStoredUsername, updateUser, checkAuth, logout, exportData, importNativeData } from "@/lib/api";
import { PasswordInput } from "@/components/ui/password-input";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "@/lib/i18n";

const API_URL_KEY = "sub_recorder_api_url";

// Currency conversion settings keys
const CURRENCY_CONVERT_ENABLED_KEY = "sub_recorder_currency_convert_enabled";
const CURRENCY_TARGET_KEY = "sub_recorder_currency_target";
const CURRENCY_DECIMALS_KEY = "sub_recorder_currency_decimals";
const CYCLE_FORMAT_KEY = "sub_recorder_cycle_format"; // "zh" or "en"
const NORMALIZE_CYCLE_KEY = "sub_recorder_normalize_cycle"; // billing cycle for normalization, e.g. "month_1"

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(API_URL_KEY);
  // null 表示未设置，返回空字符串（代理模式）
  // 空字符串表示用户明确选择代理模式
  return stored ?? "";
}

export function getCurrencyConvertEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CURRENCY_CONVERT_ENABLED_KEY) === "true";
}

export function getTargetCurrency(): string {
  if (typeof window === "undefined") return "CNY";
  return localStorage.getItem(CURRENCY_TARGET_KEY) || "CNY";
}

export function getCurrencyDecimals(): number {
  if (typeof window === "undefined") return 2;
  const val = localStorage.getItem(CURRENCY_DECIMALS_KEY);
  return val ? parseInt(val, 10) : 2;
}

export function getCycleFormat(): "zh" | "en" {
  if (typeof window === "undefined") return "zh";
  const val = localStorage.getItem(CYCLE_FORMAT_KEY);
  return val === "en" ? "en" : "zh";
}

/** 获取统计均分周期，默认 "auto"（自动取最小周期），否则返回固定 billing_cycle */
export function getNormalizeCycle(): string {
  if (typeof window === "undefined") return "auto";
  return localStorage.getItem(NORMALIZE_CYCLE_KEY) || "auto";
}

export function SettingsPage() {
  const { t } = useTranslations();
  const [apiUrl, setApiUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  // Currency conversion settings
  const [convertEnabled, setConvertEnabled] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState("CNY");
  const [decimals, setDecimals] = useState(2);
  const [cycleFormat, setCycleFormat] = useState<"zh" | "en">("zh");
  const [normalizeCycle, setNormalizeCycle] = useState("auto");

  // 汇率管理
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string>("");
  const [refreshingRates, setRefreshingRates] = useState(false);

  // 用户账户
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [demoMode, setDemoMode] = useState(false);


  const loadExchangeRateInfo = () => {
    const rates = getCurrentExchangeRates();
    if (rates) {
      const date = rates.updatedAt === "fallback"
        ? t("settings.builtin_rate")
        : new Date(rates.updatedAt).toLocaleString();
      const sampleRates = ["USD", "EUR", "JPY", "GBP"].map(cur => {
        const rate = rates.rates[cur];
        return rate ? `${cur}: ${rate.toFixed(4)}` : null;
      }).filter(Boolean).join(", ");
      setExchangeRateInfo(`${date} | ${sampleRates}`);
    } else {
      setExchangeRateInfo(t("common.loading"));
    }
  };


  useEffect(() => {
    const stored = localStorage.getItem(API_URL_KEY);
    // 显示实际存储的值，空字符串显示占位符提示
    setApiUrl(stored ?? "");
    setConvertEnabled(getCurrencyConvertEnabled());
    setTargetCurrency(getTargetCurrency());
    setDecimals(getCurrencyDecimals());
    setCycleFormat(getCycleFormat());
    setNormalizeCycle(getNormalizeCycle());
    loadExchangeRateInfo();
    // 加载用户名
    const storedUsername = getStoredUsername();
    if (storedUsername) {
      setUsername(storedUsername);
      setNewUsername(storedUsername);
    }
    // 检测 demo 模式
    checkAuth().then((info) => {
      if (info.demo_mode) setDemoMode(true);
    }).catch(() => {});
  }, []);

  const handleSave = () => {
    const trimmed = apiUrl.trim().replace(/\/+$/, "");
    localStorage.setItem(API_URL_KEY, trimmed);
    setApiUrl(trimmed);
    if (trimmed === "") {
      toast.success(t("settings.save_ok"));
    } else {
      toast.success(t("settings.save_ok"));
    }
  };

  const handleReset = () => {
    localStorage.removeItem(API_URL_KEY);
    setApiUrl("");
    toast.info(t("settings.save_ok"));
  };

  const handleRefreshRates = async () => {
    setRefreshingRates(true);
    try {
      clearExchangeRatesCache();
      const rates = await fetchExchangeRates(targetCurrency);
      loadExchangeRateInfo();
      toast.success(t("billing.rate_updated"));
    } catch (e: unknown) {
      toast.error(t("common.error") + ": " + (e instanceof Error ? e.message : ""));
    } finally {
      setRefreshingRates(false);
    }
  };


  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const trimmed = apiUrl.trim().replace(/\/+$/, "");
      // 如果是空或默认代理模式，测试 /api/auth/check
      // 否则测试用户配置的地址
      const testUrl = trimmed ? `${trimmed}/api/auth/check` : "/api/auth/check";
      const res = await fetch(testUrl, { 
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setTestResult("ok");
        toast.success(t("settings.test_ok"));
      } else {
        setTestResult("fail");
        toast.error(`${t("settings.test_fail")}: HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setTestResult("fail");
      const msg = e instanceof Error ? e.message : t("common.error");
      toast.error(`${t("settings.test_fail")}: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold font-['MiSans'] mb-6">{t("settings.title")}</h1>

      <div className="space-y-6">
        {/* API URL */}
        <div className="space-y-3 p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Server className="h-4 w-4 text-muted-foreground" />
            {t("settings.api_url")}
          </div>
          <Label className="text-xs text-muted-foreground">
            {t("settings.api_url_desc")}
          </Label>
          <Input
            value={apiUrl}
            onChange={(e) => { setApiUrl(e.target.value); setTestResult(null); }}
            placeholder="http://localhost:3456"
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {t("common.save")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? t("settings.testing") : t("settings.test")}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              {t("common.default")}
            </Button>
          </div>
          {testResult && (
            <p className={`text-xs ${testResult === "ok" ? "text-green-600" : "text-destructive"}`}>
              {testResult === "ok" ? `✓ ${t("settings.test_ok")}` : `✗ ${t("settings.test_fail")}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("settings.api_url")}: <code className="bg-muted px-1 py-0.5 rounded">{getApiBaseUrl() || "proxy"}</code>
          </p>
        </div>

        {/* Currency Conversion */}
        <div className="space-y-4 p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            {t("settings.currency_conversion")}
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("settings.currency_convert_enable")}</Label>
            <Switch
              checked={convertEnabled}
              onCheckedChange={(checked) => {
                setConvertEnabled(checked);
                localStorage.setItem(CURRENCY_CONVERT_ENABLED_KEY, String(checked));
              }}
            />
          </div>

          {/* Target Currency */}
          <div className="space-y-2">
            <Label className="text-sm">{t("settings.target_currency")}</Label>
            <Select
              value={targetCurrency}
              onValueChange={(val) => {
                setTargetCurrency(val);
                localStorage.setItem(CURRENCY_TARGET_KEY, val);
              }}
              disabled={!convertEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((code) => {
                  const cfg = getCurrencyConfig(code);
                  return (
                    <SelectItem key={code} value={code}>
                      {getSymbol(code)} {code} - {t(`currency.${code}`, cfg.name)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Exchange Rate Info */}
          {convertEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t("billing.exchange_rate")}</Label>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleRefreshRates}
                  disabled={refreshingRates}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshingRates ? "animate-spin" : ""}`} />
                  {refreshingRates ? t("common.updating") : t("billing.fetch_rate")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {exchangeRateInfo || t("common.loading")}
              </p>
            </div>
          )}

          {/* Decimal Places */}
          <div className="space-y-2">
            <Label className="text-sm">{t("settings.decimal_places")}</Label>
            <Select
              value={String(decimals)}
              onValueChange={(val) => {
                const num = parseInt(val, 10);
                setDecimals(num);
                localStorage.setItem(CURRENCY_DECIMALS_KEY, val);
              }}
              disabled={!convertEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("settings.currency_convert_enable")} ≈ {getSymbol(targetCurrency)}xxx
          </p>
        </div>

        {/* 显示设置 */}
        <div className="space-y-4 p-4 rounded-xl border bg-card">
          <div className="text-sm font-medium">{t("settings.normalize_cycle")}</div>

          {/* Normalize Cycle */}
          <div className="space-y-2">
            <Label className="text-sm">{t("settings.normalize_cycle")}</Label>
            <Label className="text-xs text-muted-foreground">{t("settings.normalize_cycle")}</Label>
            <Select
              value={normalizeCycle}
              onValueChange={(val) => {
                setNormalizeCycle(val);
                localStorage.setItem(NORMALIZE_CYCLE_KEY, val);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("settings.normalize_none")}</SelectItem>
                <SelectItem value="month_1">{t("cycle.month_1")}</SelectItem>
                <SelectItem value="month_3">{t("cycle.month_3")}</SelectItem>
                <SelectItem value="month_6">{t("cycle.month_6")}</SelectItem>
                <SelectItem value="year_1">{t("cycle.year_1")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* 账户设置 */}
        {getAuthToken() && (
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-medium text-sm">{t("settings.account")}</h3>
            {demoMode && (
              <p className="text-xs text-muted-foreground">{t("login.demo_mode")}</p>
            )}
            
            {/* 用户名 */}
            <div className="space-y-2">
              <Label className="text-sm">{t("settings.username")}</Label>
              <div className="flex gap-2">
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={t("settings.username")}
                  disabled={demoMode}
                />
                <Button
                  size="sm"
                  disabled={demoMode || savingUser || newUsername === username || !newUsername.trim()}
                  onClick={async () => {
                    setSavingUser(true);
                    try {
                      await updateUser({ username: newUsername.trim() });
                      setUsername(newUsername.trim());
                      toast.success(t("settings.save_ok"));
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : t("settings.save_fail"));
                    } finally {
                      setSavingUser(false);
                    }
                  }}
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>

            {/* 修改密码 */}
            <div className="space-y-2">
              <Label className="text-sm">{t("login.password")}</Label>
              <PasswordInput
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder={t("settings.old_password")}
                disabled={demoMode}
              />
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("settings.new_password")}
                disabled={demoMode}
              />
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("settings.new_password")}
                disabled={demoMode}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={demoMode || savingUser || !oldPassword || !newPassword || newPassword !== confirmPassword}
                onClick={async () => {
                  if (newPassword !== confirmPassword) {
                    toast.error(t("settings.password_wrong"));
                    return;
                  }
                  setSavingUser(true);
                  try {
                    await updateUser({ old_password: oldPassword, new_password: newPassword });
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    toast.success(t("settings.save_ok"));
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : t("settings.save_fail"));
                  } finally {
                    setSavingUser(false);
                  }
                }}
              >
                {t("settings.save")}
              </Button>
            </div>

            {/* 登出 */}
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={async () => {
                await logout();
                toast.success(t("settings.save_ok"));
                window.location.reload();
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("scene.logout")}
            </Button>
          </div>
        )}
        {/* 数据导入导出 */}
        <div className="border-t pt-4 space-y-4">
          <h3 className="font-medium text-sm">{t("settings.data_backup")}</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                try {
                  const data = await exportData();
                  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `sub-recorder-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(t("settings.save_ok"));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t("settings.save_fail"));
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {t("settings.export")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    // 判断格式：有 version 字段为原生格式，否则为旧格式
                    let msg: string;
                    if (data.version) {
                      msg = await importNativeData(data);
                    } else {
                      // 旧格式兼容：直接传给 /api/import
                      const { importData } = await import("@/lib/api");
                      msg = await importData(Array.isArray(data) ? data : data.subscriptions || []);
                    }
                    toast.success(msg);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "导入失败，请检查文件格式");
                  }
                };
                input.click();
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              {t("settings.import")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.export_desc")}
          </p>
        </div>

        {/* 语言切换 */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="font-medium text-sm">{t("settings.language")}</h3>
          <LanguageSwitcher />
        </div>

        {/* 关于 */}
        <div className="border-t pt-4 space-y-2">
          <h3 className="font-medium text-sm">{t("settings.about")}</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">Sub Recorder</span> — {t("settings.about_desc")}
            </p>
            <p>
              © {new Date().getFullYear()}{" "}
              <a href="https://github.com/Ysoseri1224" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Ysoseri1224</a>
              {" · "}
              <a href="https://github.com/Ysoseri1224/sub-recorder" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">GitHub</a>
              {" · "}
              AGPL-3.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
