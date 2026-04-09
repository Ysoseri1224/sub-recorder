"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseFaIcon, getFaClass } from "@/lib/fa-icons";
import { useTranslations } from "@/lib/i18n";

interface Props {
  categories: Category[];
  selectedIds: Set<number>;
  onChange: (ids: Set<number>) => void;
}

export function CategoryFilter({ categories, selectedIds, onChange }: Props) {
  const { t } = useTranslations();
  const [collapsed, setCollapsed] = useState(false);

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const allSelected = selectedIds.size === 0;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-sm font-semibold py-2 hover:text-foreground transition-colors"
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span>{t("filter.title")}</span>
        {!allSelected && (
          <span className="text-xs text-primary ml-auto mr-2">
            {selectedIds.size} {t("filter.selected")}
          </span>
        )}
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-1 pl-1">
          {/* 全部 */}
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(new Set())}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span className={cn(allSelected ? "text-foreground font-medium" : "text-muted-foreground")}>
              {t("filter.all")}
            </span>
          </label>

          {categories.map((cat) => (
            <label
              key={cat.id}
              className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:text-foreground transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(cat.id)}
                onChange={() => toggle(cat.id)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              {cat.fa_icon && (() => {
                const parsed = parseFaIcon(cat.fa_icon);
                const cls = parsed ? getFaClass(parsed.name, parsed.style) : `fa-solid ${cat.fa_icon}`;
                return <i className={`${cls} text-xs text-muted-foreground w-4 text-center`} />;
              })()}
              <span className={cn(selectedIds.has(cat.id) ? "text-foreground font-medium" : "text-muted-foreground")}>
                {t(`category.${cat.name}`, cat.name)}
              </span>
            </label>
          ))}

          {/* 无分类 */}
          <label className="flex items-center gap-2 py-1 cursor-pointer text-sm hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={selectedIds.has(-1)}
              onChange={() => toggle(-1)}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span className={cn(selectedIds.has(-1) ? "text-foreground font-medium" : "text-muted-foreground")}>
              {t("filter.uncategorized")}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
