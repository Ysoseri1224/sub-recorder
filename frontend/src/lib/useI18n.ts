"use client";

import { useState, useEffect, useCallback } from "react";
import { type Locale, getLocale, setLocale, t as rawT } from "./i18n";

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(getLocale());
    const handler = (e: Event) => {
      setLocaleState((e as CustomEvent<Locale>).detail);
    };
    window.addEventListener("locale-changed", handler);
    return () => window.removeEventListener("locale-changed", handler);
  }, []);

  const switchLocale = useCallback((l: Locale) => {
    setLocale(l);
    setLocaleState(l);
  }, []);

  const t = useCallback((key: string, fallback?: string) => rawT(key, locale, fallback), [locale]);

  return { t, locale, switchLocale };
}
