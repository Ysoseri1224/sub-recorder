"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

export type SortField = "billing_date" | "name" | "category" | "price";

interface Props {
  sortBy: SortField;
  reversed: boolean;
  onChange: (sortBy: SortField, reversed: boolean) => void;
}

export function SortOptions({ sortBy, reversed, onChange }: Props) {
  const { t } = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const SORT_OPTIONS: { id: SortField; label: string }[] = [
    { id: "billing_date", label: t("sort.next_bill") },
    { id: "name", label: t("sort.name_asc") },
    { id: "category", label: t("sub.category") },
    { id: "price", label: t("sort.price_asc") },
  ];

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-sm font-semibold py-2 hover:text-foreground transition-colors"
      >
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <span>{t("sort.label")}</span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-1 pl-1">
          {SORT_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:text-foreground transition-colors"
            >
              <input
                type="radio"
                name="sort"
                checked={sortBy === opt.id}
                onChange={() => onChange(opt.id, reversed)}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span className={cn(sortBy === opt.id ? "text-foreground font-medium" : "text-muted-foreground")}>
                {opt.label}
              </span>
            </label>
          ))}

          {/* Reverse toggle */}
          <div className="flex items-center justify-between pt-2 border-t mt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={reversed}
                onChange={(e) => onChange(sortBy, e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              <span className="text-muted-foreground">{t("sort.date_desc")}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
