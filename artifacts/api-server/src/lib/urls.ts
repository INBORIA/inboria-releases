const PRODUCTION_DOMAIN = "inboria.com";

function isProd(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function fallbackDomain(): string {
  if (isProd()) {
    return PRODUCTION_DOMAIN;
  }
  const replitDev = process.env["REPLIT_DEV_DOMAIN"];
  if (replitDev) return replitDev;
  const firstReplit = (process.env["REPLIT_DOMAINS"] || "")
    .split(",")[0]
    ?.trim();
  if (firstReplit) return firstReplit;
  return PRODUCTION_DOMAIN;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function getFrontendUrl(): string {
  const explicit = process.env["FRONTEND_URL"];
  if (explicit) return stripTrailingSlash(explicit);
  const domain = fallbackDomain();
  const protocol = domain.includes("localhost") ? "http" : "https";
  return `${protocol}://${domain}`;
}

export function getBackendUrl(): string {
  const explicit = process.env["BACKEND_URL"] || process.env["FRONTEND_URL"];
  if (explicit) return stripTrailingSlash(explicit);
  return getFrontendUrl();
}

export function getEmailOAuthRedirectUri(provider: string): string {
  return `${getBackendUrl()}/api/email/callback/${provider}`;
}

export function getIntegrationsOAuthRedirectUri(provider: string): string {
  return `${getBackendUrl()}/api/integrations/${provider}/callback`;
}

export function getCalendarOAuthRedirectUri(provider: string): string {
  return `${getBackendUrl()}/api/calendar/callback/${provider}`;
}
