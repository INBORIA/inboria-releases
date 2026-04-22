export function isPaymentsEnabled(): boolean {
  const raw = import.meta.env.VITE_PAYMENTS_ENABLED;
  if (raw === undefined || raw === null || raw === "") return false;
  return String(raw).toLowerCase() === "true" || raw === "1";
}
