import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Save } from "lucide-react";

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");
function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type MinPriority = "urgent_only" | "urgent_moyen" | "all_non_spam" | "all";

interface ChannelsPayload {
  channels: Array<{ id: string; name: string; isMember: boolean }>;
  currentChannelId: string | null;
  minPriority?: MinPriority;
}

export function SlackChannelControls({ token }: { token: string | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedMinPriority, setSelectedMinPriority] = useState<MinPriority | null>(null);

  const channelsQuery = useQuery<ChannelsPayload>({
    queryKey: ["slack-channels"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/integrations/slack/channels`, {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "failed");
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (channelsQuery.data?.currentChannelId && !selectedChannel) {
      setSelectedChannel(channelsQuery.data.currentChannelId);
    }
  }, [channelsQuery.data, selectedChannel]);

  useEffect(() => {
    if (channelsQuery.data?.minPriority) {
      setSelectedMinPriority(channelsQuery.data.minPriority);
    }
  }, [channelsQuery.data?.minPriority]);

  const saveMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const res = await fetch(`${baseUrl()}/api/integrations/slack`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["slack-channels"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast({ title: t("integrations.slack.channelSaved") });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t("integrations.slack.channelSaveError"),
        description: message,
        variant: "destructive",
      });
    },
  });

  const minPriorityMutation = useMutation({
    mutationFn: async (minPriority: MinPriority) => {
      const res = await fetch(`${baseUrl()}/api/integrations/slack/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ min_priority: minPriority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["slack-channels"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast({ title: t("integrations.slack.minPrioritySaved") });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const serverValue = channelsQuery.data?.minPriority ?? "urgent_only";
      setSelectedMinPriority(serverValue);
      qc.invalidateQueries({ queryKey: ["slack-channels"] });
      toast({
        title: t("integrations.slack.channelSaveError"),
        description: message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${baseUrl()}/api/integrations/slack/test`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data?.error || "failed");
      }
      return data as { ok: true; channel: string | null };
    },
    onSuccess: (data) => {
      const channelLabel = data.channel
        ? `#${data.channel}`
        : (channelsQuery.data?.channels.find((c) => c.id === selectedChannel)?.name
            ? `#${channelsQuery.data.channels.find((c) => c.id === selectedChannel)?.name}`
            : "Slack");
      toast({
        title: t("integrations.slack.testSuccess", { channel: channelLabel.replace(/^#/, "") }),
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t("integrations.slack.testErrorTitle"),
        description: message,
        variant: "destructive",
      });
    },
  });

  if (channelsQuery.isLoading) {
    return (
      <div className="mt-3 text-xs text-[#8b9cb3] flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("integrations.slack.channelLoading")}
      </div>
    );
  }

  if (channelsQuery.isError) {
    return (
      <div className="mt-3 text-xs text-red-400">
        {(channelsQuery.error as Error)?.message || t("integrations.slack.channelLoadError")}
      </div>
    );
  }

  const channels = (channelsQuery.data?.channels ?? []).filter((c) => c.isMember);
  const initialChannel = channelsQuery.data?.currentChannelId ?? null;
  const isDirty = selectedChannel !== null && selectedChannel !== initialChannel;

  return (
    <div className="mt-3 space-y-2 border-t border-[#1a2332] pt-3" data-testid="slack-channel-controls">
      <Label className="text-[11px] text-[#8b9cb3]">
        {t("integrations.slack.channelLabel")}
      </Label>
      {channels.length === 0 ? (
        <p className="text-xs text-[#8b9cb3]">{t("integrations.slack.channelEmpty")}</p>
      ) : (
        <Select
          value={selectedChannel ?? undefined}
          onValueChange={(v) => setSelectedChannel(v)}
        >
          <SelectTrigger className="h-8 text-xs" data-testid="select-slack-channel">
            <SelectValue placeholder={t("integrations.slack.channelPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                #{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="pt-2">
        <Label className="text-[11px] text-[#8b9cb3]">
          {t("integrations.slack.minPriorityLabel")}
        </Label>
        <Select
          value={selectedMinPriority ?? undefined}
          onValueChange={(v) => {
            const next = v as MinPriority;
            setSelectedMinPriority(next);
            minPriorityMutation.mutate(next);
          }}
        >
          <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-slack-min-priority">
            <SelectValue placeholder={t("integrations.slack.minPriorityLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent_only" className="text-xs">
              {t("integrations.slack.minPriorityUrgent")}
            </SelectItem>
            <SelectItem value="urgent_moyen" className="text-xs">
              {t("integrations.slack.minPriorityUrgentMoyen")}
            </SelectItem>
            <SelectItem value="all_non_spam" className="text-xs">
              {t("integrations.slack.minPriorityAllNonSpam")}
            </SelectItem>
            <SelectItem value="all" className="text-xs">
              {t("integrations.slack.minPriorityAll")}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-[#6b7c93] mt-1">
          {t("integrations.slack.minPriorityHint")}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          disabled={!isDirty || saveMutation.isPending}
          onClick={() => selectedChannel && saveMutation.mutate(selectedChannel)}
          data-testid="button-save-slack-channel"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Save className="h-3 w-3 mr-1" />
          )}
          {t("common.save")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!initialChannel || testMutation.isPending}
          onClick={() => testMutation.mutate()}
          data-testid="button-test-slack"
        >
          {testMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Send className="h-3 w-3 mr-1" />
          )}
          {t("integrations.slack.test")}
        </Button>
      </div>
    </div>
  );
}
