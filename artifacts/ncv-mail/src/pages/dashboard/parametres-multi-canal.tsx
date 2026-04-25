import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageCircle,
  Phone,
  ArrowLeft,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface MessagingChannel {
  id: string;
  provider: "whatsapp" | "sms_twilio" | "sms_brevo";
  displayName: string;
  phoneNumber: string;
  enabled: boolean;
  lastInboundAt: string | null;
}

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");
function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ParametresMultiCanal() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const qc = useQueryClient();
  const token = session?.access_token;

  const channelsQuery = useQuery<MessagingChannel[]>({
    queryKey: ["messaging-channels"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/messaging/channels`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  return (
    <DashboardLayout>
      <div className="p-5 max-w-4xl mx-auto w-full space-y-4">
        <div>
          <Link href="/dashboard/parametres">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[#8b9cb3] hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title")}
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            {t("settings.hub.multichannel", "Multi-canal client")}
          </h1>
          <p className="text-[12px] text-[#8b9cb3] mt-0.5">
            {t("settings.hub.multichannelDesc", "WhatsApp, SMS")}
          </p>
        </div>

        <MessagingChannelsCard
          channels={channelsQuery.data || []}
          onChange={() => qc.invalidateQueries({ queryKey: ["messaging-channels"] })}
          token={token}
        />
      </div>
    </DashboardLayout>
  );
}

function MessagingChannelsCard({
  channels,
  onChange,
  token,
}: {
  channels: MessagingChannel[];
  onChange: () => void;
  token: string | undefined;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<"whatsapp" | "sms_twilio" | "sms_brevo">("whatsapp");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [externalId, setExternalId] = useState("");
  const [token1, setToken1] = useState("");
  const { toast } = useToast();

  async function add() {
    let credentials: any = {};
    if (provider === "whatsapp") {
      credentials = { phoneNumberId: externalId, accessToken: token1 };
    } else if (provider === "sms_twilio") {
      credentials = { accountSid: externalId, authToken: token1, fromNumber: phoneNumber };
    } else if (provider === "sms_brevo") {
      credentials = { apiKey: token1 };
    }
    const res = await fetch(`${baseUrl()}/api/messaging/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ provider, displayName, phoneNumber, externalId, credentials }),
    });
    if (res.ok) {
      setAdding(false);
      setDisplayName("");
      setPhoneNumber("");
      setExternalId("");
      setToken1("");
      onChange();
      toast({ title: t("integrations.messaging.added") });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({
        title: t("integrations.messaging.addFailed"),
        description: err.error,
        variant: "destructive",
      });
    }
  }

  async function remove(id: string) {
    if (!confirm(t("integrations.confirmDisconnect"))) return;
    await fetch(`${baseUrl()}/api/messaging/channels/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    onChange();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          {t("integrations.messaging.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-[#8b9cb3]">{t("integrations.messaging.desc")}</p>

        <div className="space-y-2">
          {channels.length === 0 && (
            <p className="text-xs text-[#8b9cb3]">{t("integrations.messaging.empty")}</p>
          )}
          {channels.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border border-[#1a2332] rounded p-2 text-xs"
            >
              <div>
                <div className="font-medium flex items-center gap-2">
                  {c.provider === "whatsapp" ? (
                    <MessageCircle className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Phone className="h-3 w-3 text-[#2d7dd2]" />
                  )}
                  {c.displayName}
                </div>
                <div className="text-[#8b9cb3]">
                  {c.phoneNumber} ({c.provider})
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {!adding ? (
          <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-channel">
            <Plus className="h-3 w-3 mr-1" />
            {t("integrations.messaging.add")}
          </Button>
        ) : (
          <div className="space-y-2 border-t border-[#1a2332] pt-3">
            <Label className="text-xs">{t("integrations.messaging.provider")}</Label>
            <select
              className="w-full bg-[#1a2332] border border-[#2a3548] rounded p-2 text-xs"
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
            >
              <option value="whatsapp">WhatsApp Business</option>
              <option value="sms_twilio">SMS — Twilio</option>
              <option value="sms_brevo">SMS — Brevo</option>
            </select>
            <Input
              placeholder={t("integrations.messaging.displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              placeholder={t("integrations.messaging.phone")}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            {provider === "whatsapp" && (
              <>
                <Input
                  placeholder={t("integrations.messaging.phoneNumberId")}
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder={t("integrations.messaging.accessToken")}
                  value={token1}
                  onChange={(e) => setToken1(e.target.value)}
                />
              </>
            )}
            {provider === "sms_twilio" && (
              <>
                <Input
                  placeholder={t("integrations.messaging.accountSid")}
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder={t("integrations.messaging.authToken")}
                  value={token1}
                  onChange={(e) => setToken1(e.target.value)}
                />
              </>
            )}
            {provider === "sms_brevo" && (
              <Input
                type="password"
                placeholder={t("integrations.messaging.brevoApiKey")}
                value={token1}
                onChange={(e) => setToken1(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={add}
                disabled={!displayName || !phoneNumber}
                data-testid="button-save-channel"
              >
                {t("common.save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </Button>
            </div>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[#2d7dd2] flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {t("integrations.messaging.helpLink")}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
