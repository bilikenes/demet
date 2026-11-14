import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { AppBundle, AppConfig } from "./types";

type Mutator = (draft: AppConfig) => void;

interface ConfigStore {
  config: AppConfig;
  /** Kısayolu kaydedilemeyen öğeler için uyarılar. */
  warnings: string[];
  /** Taslağı değiştirir ve kaydeder. `debounce` yazı alanları için gecikmeli kaydeder. */
  update: (mutate: Mutator, options?: { debounce?: boolean }) => void;
  updateBundle: (id: string, mutate: (bundle: AppBundle) => void, options?: { debounce?: boolean }) => void;
}

const Ctx = createContext<ConfigStore | null>(null);

export function useConfig(): ConfigStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("useConfig, ConfigProvider içinde kullanılmalı");
  return store;
}

const DEBOUNCE_MS = 400;

export function ConfigProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const latest = useRef<AppConfig | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api.getConfig().then((loaded) => {
      if (cancelled) return;
      latest.current = loaded;
      setConfig(loaded);
    });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (!latest.current) return;
    try {
      setWarnings(await api.saveConfig(latest.current));
    } catch (error) {
      setWarnings([`Ayarlar kaydedilemedi: ${String(error)}`]);
    }
  }, []);

  // Bekleyen değişiklik varken pencere kapanırsa kaybolmasın.
  useEffect(() => {
    const flush = () => { if (timer.current !== undefined) void persist(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("blur", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("blur", flush);
    };
  }, [persist]);

  const update = useCallback<ConfigStore["update"]>((mutate, options) => {
    if (!latest.current) return;
    const next = structuredClone(latest.current);
    mutate(next);
    latest.current = next;
    setConfig(next);
    window.clearTimeout(timer.current);
    if (options?.debounce) {
      timer.current = window.setTimeout(() => void persist(), DEBOUNCE_MS);
    } else {
      void persist();
    }
  }, [persist]);

  const updateBundle = useCallback<ConfigStore["updateBundle"]>((id, mutate, options) => {
    update((draft) => {
      const bundle = draft.bundles.find((b) => b.id === id);
      if (bundle) mutate(bundle);
    }, options);
  }, [update]);

  const value = useMemo(
    () => (config ? { config, warnings, update, updateBundle } : null),
    [config, warnings, update, updateBundle],
  );

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
