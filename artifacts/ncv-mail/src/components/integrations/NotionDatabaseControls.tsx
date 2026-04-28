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
import { Loader2, Save, Send } from "lucide-react";

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");
function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface DatabasesPayload {
  databases: Array<{ id: string; title: string; lastEditedTime: string | null }>;
  currentDatabaseId: string | null;
}

export function NotionDatabaseControls({ token }: { token: string | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);

  const databasesQuery = useQuery<DatabasesPayload>({
    queryKey: ["notion-databases"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`${baseUrl()}/api/integrations/notion/databases`, {
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
    if (databasesQuery.data?.currentDatabaseId && !selectedDatabase) {
      setSelectedDatabase(databasesQuery.data.currentDatabaseId);
    }
  }, [databasesQuery.data, selectedDatabase]);

  const saveMutation = useMutation({
    mutationFn: async (databaseId: string) => {
      const res = await fetch(`${baseUrl()}/api/integrations/notion/database`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ databaseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notion-databases"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast({ title: t("integrations.notion.databaseSaved") });
    },
    onError: (err: unknown) => {
      const serverValue = databasesQuery.data?.currentDatabaseId ?? null;
      setSelectedDatabase(serverValue);
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t("integrations.notion.databaseSaveError"),
        description: message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${baseUrl()}/api/integrations/notion/test`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data?.error || "failed");
      }
      return data as {
        ok: true;
        databaseTitle: string;
        pageUrl: string | null;
      };
    },
    onSuccess: (data) => {
      toast({
        title: t("integrations.notion.testSuccess", {
          database: data.databaseTitle,
        }),
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t("integrations.notion.testErrorTitle"),
        description: message,
        variant: "destructive",
      });
    },
  });

  if (databasesQuery.isLoading) {
    return (
      <div className="mt-3 text-xs text-[#8b9cb3] flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("integrations.notion.databaseLoading")}
      </div>
    );
  }

  if (databasesQuery.isError) {
    return (
      <div className="mt-3 text-xs text-red-400">
        {(databasesQuery.error as Error)?.message ||
          t("integrations.notion.databaseLoadError")}
      </div>
    );
  }

  const databases = databasesQuery.data?.databases ?? [];
  const initialDatabase = databasesQuery.data?.currentDatabaseId ?? null;
  const isDirty =
    selectedDatabase !== null && selectedDatabase !== initialDatabase;

  return (
    <div
      className="mt-3 space-y-2 border-t border-[#1a2332] pt-3"
      data-testid="notion-database-controls"
    >
      <Label className="text-[11px] text-[#8b9cb3]">
        {t("integrations.notion.databaseLabel")}
      </Label>
      {databases.length === 0 ? (
        <p className="text-xs text-[#8b9cb3]">
          {t("integrations.notion.databaseEmpty")}
        </p>
      ) : (
        <>
          <Select
            value={selectedDatabase ?? undefined}
            onValueChange={(v) => setSelectedDatabase(v)}
          >
            <SelectTrigger
              className="h-8 text-xs"
              data-testid="select-notion-database"
            >
              <SelectValue
                placeholder={t("integrations.notion.databasePlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {databases.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-[#6b7c93]">
            {t("integrations.notion.databaseHint")}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() =>
                selectedDatabase && saveMutation.mutate(selectedDatabase)
              }
              data-testid="button-save-notion-database"
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
              disabled={!initialDatabase || testMutation.isPending}
              onClick={() => testMutation.mutate()}
              data-testid="button-test-notion"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              {t("integrations.notion.test")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
