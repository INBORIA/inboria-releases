import { useState, useMemo, useEffect, useRef } from "react";
import {
  useListTemplates,
  useIncrementTemplateUsage,
  useGetProfile,
  getGetProfileQueryKey,
  getListTemplatesQueryKey,
  type EmailTemplate,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { FileText, Loader2, Search } from "lucide-react";
import { applyTemplateVariables } from "@/lib/template-variables";

export function TemplatePickerButton({
  emailSender,
  emailSubject,
  onInsert,
}: {
  emailSender?: string | null;
  emailSubject?: string | null;
  /** Called with the resolved (variables-applied) body and subject. */
  onInsert: (body: string, subject?: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const { data: templates, isLoading } = useListTemplates({
    query: { enabled: open, queryKey: getListTemplatesQueryKey() },
  });
  const { data: profile } = useGetProfile({
    query: { enabled: open, queryKey: getGetProfileQueryKey() },
  });
  const useTemplateMut = useIncrementTemplateUsage();

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const list: EmailTemplate[] = templates ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((tpl) => {
      const hay = [
        tpl.name || "",
        tpl.subject || "",
        tpl.categoryAi || "",
        (tpl.body || "").replace(/<[^>]+>/g, " "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [templates, search]);

  const handlePick = (tpl: EmailTemplate) => {
    useTemplateMut.mutate({ id: tpl.id });
    const ctx = {
      senderEmail: emailSender || null,
      senderName: emailSender || null,
      subject: emailSubject || null,
      userFullName: profile?.fullName || null,
    };
    const body = applyTemplateVariables(tpl.body || "", ctx);
    const rawSubject = tpl.subject || "";
    const subject = rawSubject ? applyTemplateVariables(rawSubject, ctx) : undefined;
    onInsert(body, subject);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-[#b8c5d6] hover:text-white h-7 text-[11px]"
        onClick={() => setOpen(true)}
        data-testid="button-insert-template"
      >
        <FileText className="w-3 h-3 mr-1" />
        {t("templates.insertTemplate")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> {t("templates.pickerTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("templates.pickerSearch")}
                className="pl-8 h-9 text-[13px]"
              />
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-2 pb-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("common.loading", "Chargement…")}
              </div>
            ) : !templates || templates.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>{t("templates.empty")}</p>
                <p className="text-xs mt-1 opacity-70">{t("templates.emptyHint")}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {t("templates.pickerNoMatch")}
              </div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((tpl) => {
                  const preview = (tpl.body || "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 160);
                  return (
                    <li key={tpl.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(tpl)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/60 transition group"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-medium truncate">
                            {tpl.name}
                          </span>
                          {tpl.categoryAi ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                              {tpl.categoryAi}
                            </span>
                          ) : null}
                          {(tpl.usageCount || 0) > 0 ? (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {t("templates.usedCount", { count: tpl.usageCount })}
                            </span>
                          ) : null}
                        </div>
                        {tpl.subject ? (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {t("templates.subjectLabel")}: {tpl.subject}
                          </p>
                        ) : null}
                        {preview ? (
                          <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-0.5">
                            {preview}
                          </p>
                        ) : null}
                        {tpl.variables && tpl.variables.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tpl.variables.slice(0, 6).map((v: string) => (
                              <span
                                key={v}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                              >
                                {`{{${v}}}`}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
