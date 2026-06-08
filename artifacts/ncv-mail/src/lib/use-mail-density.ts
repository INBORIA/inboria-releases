import { useCallback, useEffect, useState } from "react";

export type MailDensity = "compact" | "normal" | "comfortable";

const LS_KEY = "inboria.mailDensity";
const EVT = "inboria:mail-density-changed";

const ROW_HEIGHTS: Record<MailDensity, number> = {
  compact: 44,
  normal: 52,
  comfortable: 64,
};

export function mailRowHeight(d: MailDensity): number {
  return ROW_HEIGHTS[d] ?? ROW_HEIGHTS.normal;
}

function readLs(): MailDensity {
  if (typeof window === "undefined") return "normal";
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "compact" || v === "normal" || v === "comfortable") return v;
  } catch {
    /* noop */
  }
  return "normal";
}

export function useMailDensity(): [MailDensity, (next: MailDensity) => void] {
  const [density, setDensityState] = useState<MailDensity>(readLs);

  useEffect(() => {
    const onChange = () => setDensityState(readLs());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setDensity = useCallback((next: MailDensity) => {
    try {
      window.localStorage.setItem(LS_KEY, next);
    } catch {
      /* noop */
    }
    setDensityState(next);
    window.dispatchEvent(new CustomEvent(EVT));
  }, []);

  return [density, setDensity];
}
