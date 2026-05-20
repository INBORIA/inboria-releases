import { useEffect, useState, useCallback } from "react";

export type DistributionPlatform = "apple-developer" | "google-play" | "windows-signing";

export interface DistributionCost {
  key: DistributionPlatform;
  label: string;
  vendor: string;
  description: string;
  url: string;
  pricingUsd: number;
  pricingPeriod: "annual" | "one-shot";
  amortizationMonths: number;
  monthlyCostUsd: number;
}

export const DISTRIBUTION_COSTS: Record<DistributionPlatform, DistributionCost> = {
  "apple-developer": {
    key: "apple-developer",
    label: "Apple Developer",
    vendor: "Apple Inc.",
    description: "Carte d'entrée Apple — requis pour publier sur l'App Store iOS et signer/notariser les .dmg macOS.",
    url: "https://developer.apple.com/programs/",
    pricingUsd: 99,
    pricingPeriod: "annual",
    amortizationMonths: 12,
    monthlyCostUsd: 99 / 12,
  },
  "google-play": {
    key: "google-play",
    label: "Google Play Console",
    vendor: "Google LLC",
    description: "Carte d'entrée Google — requis pour publier sur le Play Store Android. Paiement unique à vie.",
    url: "https://play.google.com/console/signup",
    pricingUsd: 25,
    pricingPeriod: "one-shot",
    amortizationMonths: 36,
    monthlyCostUsd: 25 / 36,
  },
  "windows-signing": {
    key: "windows-signing",
    label: "Windows Code Signing EV",
    vendor: "SSL.com / Sectigo / DigiCert",
    description: "Certificat Extended Validation — supprime immédiatement le warning Windows SmartScreen sur le .exe Electron desktop.",
    url: "https://www.ssl.com/certificates/ev-code-signing/",
    pricingUsd: 300,
    pricingPeriod: "annual",
    amortizationMonths: 12,
    monthlyCostUsd: 300 / 12,
  },
};

const STORAGE_KEY = "inboria.distribution.active";
const EVENT_NAME = "inboria-distribution-changed";

function readActive(): Record<DistributionPlatform, boolean> {
  const base: Record<DistributionPlatform, boolean> = {
    "apple-developer": false,
    "google-play": false,
    "windows-signing": false,
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<DistributionPlatform, boolean>>;
    return {
      "apple-developer": !!parsed["apple-developer"],
      "google-play": !!parsed["google-play"],
      "windows-signing": !!parsed["windows-signing"],
    };
  } catch {
    return base;
  }
}

function writeActive(next: Record<DistributionPlatform, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore
  }
}

export function useDistributionActive() {
  const [active, setActive] = useState<Record<DistributionPlatform, boolean>>(() => readActive());

  useEffect(() => {
    const handler = () => setActive(readActive());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const toggle = useCallback((platform: DistributionPlatform, value: boolean) => {
    setActive((prev) => {
      const next = { ...prev, [platform]: value };
      writeActive(next);
      return next;
    });
  }, []);

  return { active, toggle };
}

export function activeDistributionMonthlyEur(
  active: Record<DistributionPlatform, boolean>,
  fxUsdToEur: number,
): { totalEur: number; rows: Array<{ key: DistributionPlatform; label: string; eur: number }> } {
  const rows: Array<{ key: DistributionPlatform; label: string; eur: number }> = [];
  let total = 0;
  (Object.keys(DISTRIBUTION_COSTS) as DistributionPlatform[]).forEach((key) => {
    if (!active[key]) return;
    const cost = DISTRIBUTION_COSTS[key];
    const eur = cost.monthlyCostUsd * fxUsdToEur;
    rows.push({ key, label: cost.label, eur });
    total += eur;
  });
  return { totalEur: total, rows };
}
