import { useEffect, useState } from "react";

const LS_KEY = "inboria.readingPane.enabled";
const EVT = "inboria:reading-pane-changed";

function readLs(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LS_KEY) === "1";
}

export function useReadingPaneEnabled(): [boolean, (next?: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(readLs);
  useEffect(() => {
    const onChange = () => setEnabled(readLs());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const toggle = (next?: boolean) => {
    const v = typeof next === "boolean" ? next : !readLs();
    window.localStorage.setItem(LS_KEY, v ? "1" : "0");
    setEnabled(v);
    window.dispatchEvent(new CustomEvent(EVT));
  };
  return [enabled, toggle];
}

const PANE_OPEN_EVT = "inboria:reading-pane-open-changed";

export function notifyReadingPaneOpen(open: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PANE_OPEN_EVT, { detail: { open } }));
}

export function useReadingPaneOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ open: boolean }>;
      setOpen(!!ce.detail?.open);
    };
    window.addEventListener(PANE_OPEN_EVT, onChange);
    return () => window.removeEventListener(PANE_OPEN_EVT, onChange);
  }, []);
  return open;
}
