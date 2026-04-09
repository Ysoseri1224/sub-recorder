"use client";

import { useState } from "react";
import { LayoutDashboard, Settings, FolderOpen, Layers, Bell, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/animated-logo";
import { useTranslations } from "@/lib/i18n";

export type NavPage = "subscriptions" | "scenes" | "categories" | "notifications" | "settings" | "stats";

interface Props {
  current: NavPage;
  onChange: (page: NavPage) => void;
}

export function NavSidebar({ current, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslations();

  const NAV_ITEMS: { id: NavPage; icon: React.ElementType; labelKey: string }[] = [
    { id: "subscriptions", icon: LayoutDashboard, labelKey: "nav.subscriptions" },
    { id: "scenes", icon: Layers, labelKey: "nav.scenes" },
    { id: "stats", icon: BarChart2, labelKey: "nav.stats" },
    { id: "categories", icon: FolderOpen, labelKey: "nav.categories" },
    { id: "notifications", icon: Bell, labelKey: "nav.notifications" },
    { id: "settings", icon: Settings, labelKey: "nav.settings" },
  ];

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <div 
        className={cn(
          "hidden md:flex flex-col gap-2 py-4 px-2 border-r bg-muted/30 shrink-0 transition-all duration-200",
          expanded ? "w-40" : "w-14"
        )}
      >
        {/* Logo + Toggle */}
        <div className={cn("mb-4 select-none flex items-center", expanded ? "justify-between px-1" : "justify-center")}>
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title={expanded ? t("nav.collapse") : t("nav.expand")}
          >
            <AppLogo size={36} />
            {expanded && <span className="text-sm font-medium">Sub Recorder</span>}
          </button>
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={expanded ? undefined : t(item.labelKey)}
              className={cn(
                "rounded-lg flex items-center transition-colors",
                expanded ? "h-9 px-3 gap-3 justify-start" : "h-9 w-9 justify-center",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded && <span className="text-sm truncate">{t(item.labelKey)}</span>}
            </button>
          );
        })}

        {/* Expand button at bottom */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-auto h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
            title={t("nav.expand")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Mobile: bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 h-14 px-2 safe-bottom">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-tight">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
