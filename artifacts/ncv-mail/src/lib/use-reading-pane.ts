import { useCallback, useEffect, useState } from "react";

export type ReadingPanePosition = "right" | "bottom" | "off";

const LS_KEY = "inboria.readingPane.enabled";
const POS_KEY = "inboria.readingPane.position";
const LAST_KEY = "inboria.readingPane.lastPos";
const EVT = "inboria:reading-pane-changed";

function readLastPosition(): Exclude<ReadingPanePosition, "off"> {
  if (typeof window === "undefined") return "right";
  try {
    const p = window.localStorage.getItem(LAST_KEY);
    if (p === "right" || p === "bottom") return p;
  } catch {
    /* noop */
  }
  return "right";
}

function readPosition(): ReadingPanePosition {
  if (typeof window === "undefined") return "off";
  try {
    const p = window.localStorage.getItem(POS_KEY);
    if (p === "right" || p === "bottom" || p === "off") return p;
    // Migration from the legacy boolean key.
    if (window.localStorage.getItem(LS_KEY) === "1") return "right";
  } catch {
    /* noop */
  }
  return "off";
}

function writePosition(pos: ReadingPanePosition) {
  try {
    window.localStorage.setItem(POS_KEY, pos);
    // Remember the last visible side so the legacy on/off toggle can restore it.
    if (pos !== "off") window.localStorage.setItem(LAST_KEY, pos);
    // Keep the legacy boolean key in sync for any reader still using it.
    window.localStorage.setItem(LS_KEY, pos === "off" ? "0" : "1");
  } catch {
    /* noop */
  }
}

function readEnabled(): boolean {
  return readPosition() !== "off";
}

export function useReadingPanePosition(): [ReadingPanePosition, (pos: ReadingPanePosition) => void] {
  const [pos, setPosState] = useState<ReadingPanePosition>(readPosition);
  useEffect(() => {
    const onChange = () => setPosState(readPosition());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const setPos = useCallback((next: ReadingPanePosition) => {
    writePosition(next);
    setPosState(next);
    window.dispatchEvent(new CustomEvent(EVT));
  }, []);
  return [pos, setPos];
}

export function useReadingPaneEnabled(): [boolean, (next?: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(readEnabled);
  useEffect(() => {
    const onChange = () => setEnabled(readEnabled());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const toggle = (next?: boolean) => {
    const v = typeof next === "boolean" ? next : !readEnabled();
    // Turning on restores the last visible position (right or bottom, defaults to right).
    writePosition(v ? readLastPosition() : "off");
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
