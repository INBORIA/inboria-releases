import { useCallback, useEffect, useState } from "react";

const LS_KEY = "inboria.mailHeader.collapsed";
const EVT = "inboria:mail-header-collapsed-change";

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function useMailHeaderCollapsed(): [boolean, () => void, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(readInitial);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setCollapsedState(!!detail);
    };
    window.addEventListener(EVT, onChange as EventListener);
    return () => window.removeEventListener(EVT, onChange as EventListener);
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    try {
      window.localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {}
    window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
    setCollapsedState(v);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!readInitial());
  }, [setCollapsed]);

  return [collapsed, toggle, setCollapsed];
}
