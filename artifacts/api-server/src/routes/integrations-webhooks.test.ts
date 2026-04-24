/**
 * Integration tests for inbound CRM webhooks (HubSpot v3 + Pipedrive).
 *
 * These tests prove the full chain: signed inbound webhook → signature verified →
 * tenant resolved via integrations.settings.{hubId|companyId} → per-user CRM sync invoked.
 *
 * We mock supabaseAdmin (returns a known user_id for the lookup) and the sync
 * functions (so we can assert they are called with the correct user_id), then
 * mount the integrations router on a fresh express app and hit it with fetch.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { createHmac } from "crypto";
import { createServer, type Server } from "http";
import express, { type Request } from "express";

const syncHubspotContactsMock = vi.fn(async () => ({ synced: 0 }));
const syncHubspotDealsMock = vi.fn(async () => ({ synced: 0 }));
const syncPipedriveContactsMock = vi.fn(async () => ({ synced: 0 }));
const syncPipedriveDealsMock = vi.fn(async () => ({ synced: 0 }));

vi.mock("../services/hubspot", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    syncHubspotContacts: syncHubspotContactsMock,
    syncHubspotDeals: syncHubspotDealsMock,
  };
});

vi.mock("../services/pipedrive", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    syncPipedriveContacts: syncPipedriveContactsMock,
    syncPipedriveDeals: syncPipedriveDealsMock,
  };
});

type IntegrationRow = { user_id: string; provider: string; settings: Record<string, unknown> };
const integrationRows: IntegrationRow[] = [];

function buildSupabaseQuery(): any {
  let provider: string | null = null;
  let containsFilter: Record<string, unknown> | null = null;
  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => {
      if (col === "provider") provider = String(val);
      return builder;
    },
    contains: (_col: string, val: Record<string, unknown>) => {
      containsFilter = val;
      return builder;
    },
    then: (resolve: (v: any) => void) => {
      const data = integrationRows.filter((r) => {
        if (provider && r.provider !== provider) return false;
        if (containsFilter) {
          for (const [k, v] of Object.entries(containsFilter)) {
            if (r.settings[k] !== v) return false;
          }
        }
        return true;
      });
      resolve({ data, error: null });
    },
  };
  return builder;
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: (_table: string) => buildSupabaseQuery(),
    rpc: vi.fn(),
  },
}));

let server: Server;
let baseUrl: string;

beforeEach(() => {
  syncHubspotContactsMock.mockClear();
  syncHubspotDealsMock.mockClear();
  syncPipedriveContactsMock.mockClear();
  syncPipedriveDealsMock.mockClear();
  integrationRows.length = 0;
  process.env["HUBSPOT_CLIENT_SECRET"] = "test-hub-secret";
  process.env["PIPEDRIVE_WEBHOOK_SECRET"] = "test-pd-secret";
});

afterAll(() => {
  if (server) server.close();
});

async function startServer(): Promise<void> {
  if (server) return;
  // Import after mocks are registered.
  const integrationsRouter = (await import("./integrations")).default;
  const app = express();
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use("/api", integrationsRouter);
  await new Promise<void>((resolve) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

describe("HubSpot inbound webhook → tenant resolution → sync", () => {
  it("rejects unsigned requests with 401", async () => {
    await startServer();
    const res = await fetch(`${baseUrl}/api/integrations/hubspot/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ portalId: 999, eventId: 1 }]),
    });
    expect(res.status).toBe(401);
    expect(syncHubspotContactsMock).not.toHaveBeenCalled();
  });

  it("rejects requests with a stale timestamp", async () => {
    await startServer();
    const url = `${baseUrl}/api/integrations/hubspot/webhook`;
    const body = JSON.stringify([{ portalId: 4242, eventId: 9 }]);
    const ts = String(Date.now() - 10 * 60 * 1000); // 10 min in the past
    const sig = createHmac("sha256", "test-hub-secret")
      .update("POST" + url + body + ts)
      .digest("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HubSpot-Signature-v3": sig,
        "X-HubSpot-Request-Timestamp": ts,
      },
      body,
    });
    expect(res.status).toBe(401);
    expect(syncHubspotContactsMock).not.toHaveBeenCalled();
  });

  it("verifies a valid v3 signature, resolves the tenant by hubId, and triggers sync", async () => {
    await startServer();
    integrationRows.push({
      user_id: "user-hub-123",
      provider: "hubspot",
      settings: { hubId: 4242, portalId: 4242 },
    });

    const url = `${baseUrl}/api/integrations/hubspot/webhook`;
    const body = JSON.stringify([
      { portalId: 4242, eventId: 11, subscriptionType: "contact.creation" },
    ]);
    const ts = String(Date.now());
    const sig = createHmac("sha256", "test-hub-secret")
      .update("POST" + url + body + ts)
      .digest("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HubSpot-Signature-v3": sig,
        "X-HubSpot-Request-Timestamp": ts,
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; processed: number };
    expect(json).toEqual({ ok: true, processed: 1 });

    // The route fires sync calls without awaiting them — give them a microtask tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(syncHubspotContactsMock).toHaveBeenCalledWith("user-hub-123", 100);
    expect(syncHubspotDealsMock).toHaveBeenCalledWith("user-hub-123", 100);
  });

  it("does not invoke sync when no tenant matches the portalId", async () => {
    await startServer();
    integrationRows.push({
      user_id: "user-other",
      provider: "hubspot",
      settings: { hubId: 1111 },
    });

    const url = `${baseUrl}/api/integrations/hubspot/webhook`;
    const body = JSON.stringify([{ portalId: 9999, eventId: 1 }]);
    const ts = String(Date.now());
    const sig = createHmac("sha256", "test-hub-secret")
      .update("POST" + url + body + ts)
      .digest("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HubSpot-Signature-v3": sig,
        "X-HubSpot-Request-Timestamp": ts,
      },
      body,
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(syncHubspotContactsMock).not.toHaveBeenCalled();
  });
});

describe("Pipedrive inbound webhook → tenant resolution → sync", () => {
  it("rejects unsigned requests with 401", async () => {
    await startServer();
    const res = await fetch(`${baseUrl}/api/integrations/pipedrive/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "added.person", meta: { company_id: 77 } }),
    });
    expect(res.status).toBe(401);
    expect(syncPipedriveContactsMock).not.toHaveBeenCalled();
  });

  it("verifies the signature, resolves the tenant by companyId, and triggers sync", async () => {
    await startServer();
    integrationRows.push({
      user_id: "user-pd-456",
      provider: "pipedrive",
      settings: { apiDomain: "https://acme.pipedrive.com", companyId: 77 },
    });

    const url = `${baseUrl}/api/integrations/pipedrive/webhook`;
    const body = JSON.stringify({
      event: "added.person",
      meta: { company_id: 77, action: "added", object: "person" },
      current: { id: 1 },
    });
    const sig = "sha256=" + createHmac("sha256", "test-pd-secret").update(body).digest("hex");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pipedrive-Signature": sig,
      },
      body,
    });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(syncPipedriveContactsMock).toHaveBeenCalledWith("user-pd-456", 100);
    expect(syncPipedriveDealsMock).toHaveBeenCalledWith("user-pd-456", 100);
  });
});
