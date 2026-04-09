"use client";

import { useI18n } from "@/lib/useI18n";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, switchLocale } = useI18n();

  const options: { value: Locale; label: string }[] = [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
  ];

  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => switchLocale(opt.value)}
          className={[
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            locale === opt.value
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
