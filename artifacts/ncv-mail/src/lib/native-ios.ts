type NativeScanResult = {
  path?: string;
  name?: string;
  mimeType?: string;
};

function capacitor(): any {
  return typeof window === "undefined" ? null : (window as any).Capacitor;
}

export function hasNativeIosScanner(): boolean {
  const cap = capacitor();
  return Boolean(
    cap?.isNativePlatform?.() &&
      cap?.getPlatform?.() === "ios" &&
      cap?.Plugins?.InboriaNative?.scanDocument &&
      cap?.Plugins?.Filesystem?.readFile,
  );
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function scanNativeDocument(): Promise<File | null> {
  if (!hasNativeIosScanner()) return null;
  const cap = capacitor();
  try {
    const scanned = (await cap.Plugins.InboriaNative.scanDocument()) as NativeScanResult;
    if (!scanned?.path) return null;
    const result = await cap.Plugins.Filesystem.readFile({ path: scanned.path });
    if (typeof result?.data !== "string" || !result.data) return null;
    return new File(
      [base64ToBytes(result.data)],
      scanned.name || `Scan-Inboria-${Date.now()}.pdf`,
      { type: scanned.mimeType || "application/pdf" },
    );
  } catch (error: any) {
    if (error?.code === "SCAN_CANCELLED" || /annul/i.test(String(error?.message || ""))) {
      return null;
    }
    throw error;
  }
}

export function initNativeIosSecurity(): void {
  const cap = capacitor();
  if (
    !cap?.isNativePlatform?.() ||
    cap?.getPlatform?.() !== "ios" ||
    !cap?.Plugins?.InboriaNative?.authenticate
  ) {
    return;
  }

  let authenticating = false;
  let hiddenAt = 0;
  const language = String(navigator.language || "fr").toLowerCase();
  const label = language.startsWith("fr") ? "Déverrouiller Inboria" : "Unlock Inboria";

  const ensureOverlay = () => {
    let overlay = document.getElementById("inboria-native-lock");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "inboria-native-lock";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:#07111f;color:#fff;display:flex;align-items:center;justify-content:center;font:600 16px system-ui";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText =
      "border:0;border-radius:12px;padding:14px 22px;background:#2d7dd2;color:#fff;font:600 16px system-ui";
    button.addEventListener("click", () => void authenticate());
    overlay.appendChild(button);
    document.body.appendChild(overlay);
    return overlay;
  };

  const authenticate = async () => {
    if (authenticating) return;
    authenticating = true;
    const overlay = ensureOverlay();
    try {
      const result = await cap.Plugins.InboriaNative.authenticate({ reason: label });
      if (result?.success || result?.available === false) overlay.remove();
    } finally {
      authenticating = false;
    }
  };

  const start = () => void authenticate();
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt >= 60_000) {
      void authenticate();
    }
  });
}