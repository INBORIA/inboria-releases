import {
  useSuggestTemplates,
  useIncrementTemplateUsage,
  useGetProfile,
  getSuggestTemplatesQueryKey,
  getGetProfileQueryKey,
  type EmailTemplate,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { FileText, Sparkles } from "lucide-react";
import { applyTemplateVariables } from "@/lib/template-variables";

export function TemplateSuggestionBar({
  emailId,
  enabled,
  onInsert,
  emailSender,
  emailSubject,
}: {
  emailId: number;
  enabled: boolean;
  /** Raw `From` header value of the email being replied to. */
  emailSender?: string | null;
  emailSubject?: string | null;
  onInsert: (body: string, subject?: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useSuggestTemplates(
    { emailId },
    {
      query: {
        enabled,
        staleTime: 60_000,
        queryKey: getSuggestTemplatesQueryKey({ emailId }),
      },
    },
  );
  const { data: profile } = useGetProfile({
    query: { enabled, queryKey: getGetProfileQueryKey() },
  });
  const useTemplateMut = useIncrementTemplateUsage();

  if (!enabled) return null;
  if (isLoading) return null;
  const templates: EmailTemplate[] = data?.templates ?? [];
  if (!templates.length) return null;

  const handleInsert = (tpl: EmailTemplate) => {
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
  };

  return (
    <div className="border border-border/60 rounded-md p-2 bg-muted/30">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8b9cb3] mb-1.5">
        <Sparkles className="h-3 w-3" /> {t("templates.suggestionTitle")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {templates.slice(0, 3).map((tpl) => (
          <Button
            key={tpl.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => handleInsert(tpl)}
          >
            <FileText className="h-3 w-3 mr-1" />
            {tpl.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
