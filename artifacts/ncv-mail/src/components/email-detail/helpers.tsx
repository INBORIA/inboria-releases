import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { convert as htmlToPlainText } from "html-to-text";

export const PRIORITY_BAR_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  moyen: "bg-amber-500",
  faible: "bg-emerald-500",
};

export const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  urgent: { bg: "bg-white/10", text: "text-white", border: "border-white/20", labelKey: "inbox.priorities.urgent" },
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

// Construit la citation de transfert au format HTML — préserve la mise en
// forme et les images de l'email d'origine quand le body est HTML (sinon on
// retombe sur la version texte). Style Gmail : un en-tête meta + un
// blockquote contenant le body HTML brut.
export function buildForwardCitationHtml(email: any, t: (k: string) => string, dateLocale: any): string {
  const esc = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
  const rawBody = (email?.body || "").toString();
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(rawBody);
  const meta =
    `<div>${esc(header)}</div>` +
    `<div><b>${esc(fromLabel)} :</b> ${esc(email?.sender || "")}</div>` +
    `<div><b>${esc(dateLabel)} :</b> ${esc(dateStr)}</div>` +
    `<div><b>${esc(subjectLabel)} :</b> ${esc(email?.subject || "")}</div>` +
    `<div><b>${esc(toLabel)} :</b> ${esc(email?.recipient || "")}</div>`;
  const bodyHtml = looksLikeHtml
    ? rawBody
    : esc(rawBody).split("\n").join("<br>");
  return (
    `<br><br>` +
    `<div class="ncv-forward-citation" style="border-left:2px solid #ccc;padding:0 0 0 12px;margin:8px 0;color:inherit;">` +
    meta +
    `<br>` +
    bodyHtml +
    `</div>`
  );
}
