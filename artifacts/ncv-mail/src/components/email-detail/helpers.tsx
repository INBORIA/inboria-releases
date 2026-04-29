import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { convert as htmlToPlainText } from "html-to-text";

export const PRIORITY_BAR_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  moyen: "bg-amber-500",
  faible: "bg-emerald-500",
};

export const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", labelKey: "inbox.priorities.urgent" },
  moyen: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", labelKey: "inbox.priorities.medium" },
  faible: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", labelKey: "inbox.priorities.low" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const ps = PRIORITY_BADGE_STYLES[priority] || PRIORITY_BADGE_STYLES.faible;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${ps.bg} ${ps.text} ${ps.border}`}>
      {t(ps.labelKey)}
    </span>
  );
}

export function htmlBodyToPlainText(raw: string): string {
  if (!raw) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(raw);
  if (!looksLikeHtml) return raw;
  try {
    const text = htmlToPlainText(raw, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "script", format: "skip" },
        { selector: "head", format: "skip" },
        { selector: "a", options: { ignoreHref: false, hideLinkHrefIfSameAsText: true } },
        { selector: "hr", format: "skip" },
      ],
    });
    return text.replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return raw.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  }
}

export function buildForwardCitation(email: any, t: (k: string) => string, dateLocale: any): string {
  const header = t("inbox.forwardCitationHeader");
  const fromLabel = t("inbox.forwardFromLabel");
  const dateLabel = t("inbox.forwardDateLabel");
  const subjectLabel = t("inbox.forwardSubjectLabel");
  const toLabel = t("inbox.forwardToLabel");
  let dateStr = "";
  try {
    const rawDate = email?.createdAt || email?.created_at || email?.received_at;
    if (rawDate) dateStr = format(new Date(rawDate), "Pp", { locale: dateLocale });
  } catch { dateStr = ""; }
  const plainBody = htmlBodyToPlainText(email?.body || "");
  const lines = [
    "",
    header,
    `${fromLabel} : ${email?.sender || ""}`,
    `${dateLabel} : ${dateStr}`,
    `${subjectLabel} : ${email?.subject || ""}`,
    `${toLabel} : ${email?.recipient || ""}`,
    "",
    plainBody.split("\n").map((l: string) => `> ${l}`).join("\n"),
  ];
  return lines.join("\n");
}
