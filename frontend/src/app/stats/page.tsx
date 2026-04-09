"use client";

import { useEffect, useState } from "react";
import { getStats, type StatsData } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";

function formatCycle(cycle: string, t: (k: string) => string): string {
  const key = `cycle.${cycle}`;
  const val = t(key);
  return val === key ? cycle : val;
}

function BarChart({ data, labelKey, valueKey }: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0));
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-right text-gray-500 dark:text-gray-400 truncate">
              {String(item[labelKey])}
            </span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-5 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-xs text-gray-700 dark:text-gray-300 text-right">
              {val.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const slices = data.map(d => {
    const start = cumulative;
    cumulative += d.value / total;
    return { ...d, start, end: cumulative };
  });

  function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function slicePath(start: number, end: number, r: number, cx: number, cy: number) {
    const s = polarToCartesian(cx, cy, r, start * 360);
    const e = polarToCartesian(cx, cy, r, end * 360);
    const large = end - start > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
  }

  const colors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899","#6366f1"];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-40 h-40 shrink-0">
        {slices.map((s, i) => (
          <path
            key={i}
            d={slicePath(s.start, s.end, 90, 100, 100)}
            fill={colors[i % colors.length]}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-gray-700 dark:text-gray-300">{s.label}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-auto pl-4">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">{t("common.loading")}</div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-500">{error}</div>
  );
  if (!stats) return null;

  const hasData = stats.monthly.length > 0 || stats.by_category.length > 0;

  const pieData = stats.by_category.map(c => ({
    label: t(`category.${c.category_name}`, c.category_name),
    value: c.amount,
    color: "",
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("stats.title")}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400">{t("stats.active_subs")}</p>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.total_active}</p>
        </div>
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">{t("stats.suspended_subs")}</p>
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{stats.total_suspended}</p>
        </div>
      </div>

      {!hasData && (
        <p className="text-center text-gray-400 dark:text-gray-500 py-8">{t("stats.no_data")}</p>
      )}

      {/* Monthly spend */}
      {stats.monthly.length > 0 && (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">{t("stats.monthly_spend")}</h2>
          <BarChart
            data={stats.monthly as unknown as Record<string, unknown>[]}
            labelKey="month"
            valueKey="amount"
          />
        </section>
      )}

      {/* Yearly spend */}
      {stats.yearly.length > 0 && (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">{t("stats.yearly_spend")}</h2>
          <BarChart
            data={stats.yearly as unknown as Record<string, unknown>[]}
            labelKey="month"
            valueKey="amount"
          />
        </section>
      )}

      {/* By category */}
      {stats.by_category.length > 0 && (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">{t("stats.by_category")}</h2>
          <PieChart data={pieData} />
          <div className="mt-4 space-y-1">
            {stats.by_category.map((c, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{t(`category.${c.category_name}`, c.category_name)}</span>
                <span className="text-gray-500 dark:text-gray-400">{c.amount.toFixed(2)} / mo · {c.count} subs</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
