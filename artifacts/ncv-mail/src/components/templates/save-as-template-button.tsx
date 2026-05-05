import { useState } from "react";
import {
  useCreateTemplate,
  useSuggestTemplateName,
  getListTemplatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { BookmarkPlus, Sparkles, Loader2 } from "lucide-react";

export function SaveAsTemplateButton({
  subject,
  body,
  sourceEmailId,
}: {
  subject: string;
  body: string;
  sourceEmailId?: number;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createMutation = useCreateTemplate();
  const suggestNameMutation = useSuggestTemplateName();

  const handleSuggestName = () => {
    suggestNameMutation.mutate(
      {
        data: {
          subject: subject || "",
          body: body || "",
          ...(sourceEmailId !== undefined ? { sourceEmailId } : {}),
        },
      },
      {
        onSuccess: (resp) => {
          if (resp?.name) setName(resp.name);
        },
        onError: () => {
          toast({
            title: t("templates.errors.suggestNameFailed"),
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: t("templates.errors.nameRequired"), variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          name: name.trim(),
          subject: subject || "",
          body: body || "",
          sourceEmailId,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
          setOpen(false);
          setName("");
          toast({ title: t("templates.savedAsTemplate") });
        },
        onError: () => toast({ title: t("templates.errors.saveFailed"), variant: "destructive" }),
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-[#b8c5d6] hover:text-white h-7 text-[11px]"
        disabled={!body?.trim()}
        onClick={() => {
          setName(subject ? subject.slice(0, 80) : "");
          setOpen(true);
        }}
      >
        <BookmarkPlus className="w-3 h-3 mr-1" />
        {t("templates.saveAsTemplate")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("templates.saveAsTemplate")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("templates.fields.name")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestName}
                  disabled={
                    suggestNameMutation.isPending ||
                    (!subject?.trim() && !body?.trim())
                  }
                  title={t("templates.suggestNameWithAI")}
                >
                  {suggestNameMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1 text-[11px]">
                    {t("templates.suggestNameShort")}
                  </span>
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
