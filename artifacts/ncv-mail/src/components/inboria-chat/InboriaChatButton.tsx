import { useState, useRef, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Send, Loader2, User as UserIcon, Mail, Pencil, Check, AlertCircle, X, Calendar, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface InboriaDraft {
  to: string;
  subject: string;
  body: string;
}

interface InboriaMeeting {
  to: string;
  contactName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
}

// Parse one fenced `inboria-meeting` block body (YAML-like) into an
// InboriaMeeting object, or null if the block is incomplete.
function parseMeetingBlock(inner: string): InboriaMeeting | null {
  const KEY_MAP: Record<string, keyof InboriaMeeting> = {
    to: "to",
    contactname: "contactName",
    subject: "subject",
    startat: "startAt",
    endat: "endAt",
    location: "location",
  };
  const fields: Partial<Record<keyof InboriaMeeting, string>> = {};
  for (const line of inner.replace(/\r/g, "").split("\n")) {
    const fm = /^\s*(to|contactName|subject|startAt|endAt|location)\s*:\s*(.*)$/i.exec(line);
    if (fm) {
      const key = KEY_MAP[fm[1].toLowerCase()];
      if (key) fields[key] = fm[2].trim().replace(/^["'<\[]+|["'>\]]+$/g, "");
    }
  }
  const startMs = fields.startAt ? Date.parse(fields.startAt) : NaN;
  const endMs = fields.endAt ? Date.parse(fields.endAt) : NaN;
  if (!fields.to || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return {
    to: fields.to,
    contactName: fields.contactName || "",
    subject: fields.subject || "",
    startAt: fields.startAt || "",
    endAt: fields.endAt || "",
    location: fields.location || "",
  };
}

// Splits an assistant message into ordered segments of plain text and meeting
// cards, supporting MULTIPLE `inboria-meeting` blocks AND `inboria-multi-meeting`
// blocks (un seul mail listant plusieurs créneaux au choix) dans le même
// message.
interface InboriaMultiMeeting {
  to: string;
  contactName: string;
  subject: string;
  location: string;
  slots: Array<{ startAt: string; endAt: string }>;
}

function parseMultiMeetingBlock(inner: string): InboriaMultiMeeting | null {
  const lines = inner.replace(/\r/g, "").split("\n");
  const fields: { to?: string; contactName?: string; subject?: string; location?: string } = {};
  const slots: Array<{ startAt: string; endAt: string }> = [];
  let i = 0;
  let inSlots = false;
  let cur: { startAt?: string; endAt?: string } | null = null;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!inSlots) {
      if (/^\s*slots\s*:\s*$/i.test(line)) {
        inSlots = true;
        i++;
        continue;
      }
      const fm = /^\s*(to|contactName|subject|location)\s*:\s*(.*)$/i.exec(line);
      if (fm) {
        const k = fm[1].toLowerCase();
        const v = fm[2].trim().replace(/^["'<\[]+|["'>\]]+$/g, "");
        if (k === "to") fields.to = v;
        else if (k === "contactname") fields.contactName = v;
        else if (k === "subject") fields.subject = v;
        else if (k === "location") fields.location = v;
      }
      i++;
      continue;
    }
    // inSlots
    if (/^\s*-\s*startAt\s*:/i.test(line) || /^\s*-\s*$/.test(line)) {
      if (cur && cur.startAt && cur.endAt) slots.push({ startAt: cur.startAt, endAt: cur.endAt });
      cur = {};
      const sm = /startAt\s*:\s*(.*)$/i.exec(line);
      if (sm) cur.startAt = sm[1].trim().replace(/^["'<\[]+|["'>\]]+$/g, "");
      i++;
      continue;
    }
    const sm = /^\s*startAt\s*:\s*(.*)$/i.exec(line);
    const em = /^\s*endAt\s*:\s*(.*)$/i.exec(line);
    if (sm && cur) {
      cur.startAt = sm[1].trim().replace(/^["'<\[]+|["'>\]]+$/g, "");
      i++;
      continue;
    }
    if (em && cur) {
      cur.endAt = em[1].trim().replace(/^["'<\[]+|["'>\]]+$/g, "");
      i++;
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    // ligne non reconnue : on sort de la section slots
    break;
  }
  if (cur && cur.startAt && cur.endAt) slots.push({ startAt: cur.startAt, endAt: cur.endAt });
  const validSlots = slots.filter(
    (s) => Number.isFinite(Date.parse(s.startAt)) && Number.isFinite(Date.parse(s.endAt)),
  );
  if (!fields.to || validSlots.length < 2) return null;
  return {
    to: fields.to,
    contactName: fields.contactName || "",
    subject: fields.subject || "",
    location: fields.location || "",
    slots: validSlots,
  };
}

type MeetingSegment =
  | { kind: "text"; text: string }
  | { kind: "meeting"; meeting: InboriaMeeting }
  | { kind: "multi"; multi: InboriaMultiMeeting };

function extractMeetings(text: string): MeetingSegment[] {
  const fenceRe = /```inboria-(multi-meeting|meeting)\s*\n([\s\S]*?)```/gi;
  const segments: MeetingSegment[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const kind = m[1].toLowerCase();
    if (kind === "multi-meeting") {
      const multi = parseMultiMeetingBlock(m[2]);
      if (!multi) continue;
      const before = text.slice(cursor, m.index).trim();
      if (before) segments.push({ kind: "text", text: before });
      segments.push({ kind: "multi", multi });
      cursor = m.index + m[0].length;
    } else {
      const meeting = parseMeetingBlock(m[2]);
      if (!meeting) continue;
      const before = text.slice(cursor, m.index).trim();
      if (before) segments.push({ kind: "text", text: before });
      segments.push({ kind: "meeting", meeting });
      cursor = m.index + m[0].length;
    }
  }
  if (segments.length === 0) return [];
  const tail = text.slice(cursor).trim();
  if (tail) segments.push({ kind: "text", text: tail });
  return segments;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parse a fenced `inboria-draft` block (YAML-like) inside an assistant message.
// Returns { draft, before, after } when found, otherwise { draft: null }.
function extractDraft(text: string): {
  draft: InboriaDraft | null;
  before: string;
  after: string;
} {
  const fenceRe = /```inboria-draft\s*\n([\s\S]*?)```/i;
  const m = fenceRe.exec(text);
  if (!m) return { draft: null, before: text, after: "" };
  const before = text.slice(0, m.index).trim();
  const after = text.slice(m.index + m[0].length).trim();
  const inner = m[1].replace(/\r/g, "");
  const lines = inner.split("\n");
  let to = "";
  let subject = "";
  let body = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const toM = /^to\s*:\s*(.*)$/i.exec(line);
    const subjM = /^subject\s*:\s*(.*)$/i.exec(line);
    // Accepte "body:", "body: |", "body: |-", "body: >" (en-tete YAML
    // multi-ligne) OU "body: <texte sur une seule ligne>" si le LLM
    // n'a pas suivi le format pipe.
    const bodyHeader = /^body\s*:\s*([|>][-+]?)?\s*(.*)$/i.exec(line);
    if (toM) {
      to = toM[1].trim().replace(/^[<\[]+|[>\]]+$/g, "");
      i++;
    } else if (subjM) {
      subject = subjM[1].trim();
      i++;
    } else if (bodyHeader) {
      const inlineBody = (bodyHeader[2] ?? "").trim();
      const hasBlockMarker = !!bodyHeader[1];
      // Cas degrade : body sur la meme ligne, sans bloc litteral. On le
      // prend tel quel et on continue, en concatenant aussi d'eventuelles
      // lignes indentees suivantes.
      if (inlineBody && !hasBlockMarker) {
        body = inlineBody;
        i++;
        const extra: string[] = [];
        while (i < lines.length) {
          const bl = lines[i] ?? "";
          if (/^(to|subject|body)\s*:/i.test(bl)) break;
          if (bl.trim() === "") { extra.push(""); i++; continue; }
          const lead = bl.match(/^(\s+)/);
          if (!lead) break;
          extra.push(bl.trim());
          i++;
        }
        if (extra.length) body = (body + "\n" + extra.join("\n")).replace(/\s+$/, "");
        continue;
      }
      i++;
      const bodyLines: string[] = [];
      // Determine indent from first non-empty line
      let indent = -1;
      while (i < lines.length) {
        const bl = lines[i] ?? "";
        if (indent < 0 && bl.trim() === "") {
          bodyLines.push("");
          i++;
          continue;
        }
        if (indent < 0) {
          const lead = bl.match(/^(\s*)/)?.[1] ?? "";
          indent = lead.length > 0 ? lead.length : 0;
        }
        if (bl.trim() === "") {
          bodyLines.push("");
          i++;
          continue;
        }
        const lead = bl.match(/^(\s*)/)?.[1].length ?? 0;
        if (lead < indent && bl.trim() !== "") break;
        bodyLines.push(bl.slice(indent));
        i++;
      }
      body = bodyLines.join("\n").replace(/\s+$/, "");
    } else {
      i++;
    }
  }
  if (!to && !subject && !body) return { draft: null, before: text, after: "" };
  return { draft: { to, subject, body }, before, after };
}

// Parse "[mail#1234]" markers in assistant replies and render them as
// inline clickable chips that open the email in the dashboard.
function renderAssistantContent(
  text: string,
  onOpenMail: (id: number) => void,
): React.ReactNode {
  const re = /\[mail#(\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const id = Number(m[1]);
    parts.push(
      <button
        key={`mail-${key++}-${id}`}
        type="button"
        onClick={() => onOpenMail(id)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 text-xs font-medium transition-colors align-baseline"
        data-testid={`inboria-chat-mail-link-${id}`}
        title={`Ouvrir le mail #${id}`}
      >
        <Mail className="h-3 w-3" />
        Ouvrir
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

interface DraftCardProps {
  draft: InboriaDraft;
  accessToken: string;
  baseUrl: string;
  primaryFrom: string;
  onEdit: (d: InboriaDraft) => void;
  onSent: () => void;
}

const DraftCard = memo(function DraftCard({ draft, accessToken, baseUrl, primaryFrom, onEdit, onSent }: DraftCardProps) {
  const [stage, setStage] = useState<"idle" | "confirm" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sentAt, setSentAt] = useState<string>("");
  const [resolvedFrom, setResolvedFrom] = useState<string>("");

  const toValid = EMAIL_RE.test(draft.to.trim());
  const blockReason = !toValid
    ? draft.to.trim()
      ? "Adresse destinataire invalide — ouvrez Modifier pour corriger."
      : "Destinataire manquant — ouvrez Modifier pour le compléter."
    : "";

  const doSend = async () => {
    setStage("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`${baseUrl}/api/emails/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ to: draft.to.trim(), subject: draft.subject, body: draft.body }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Échec de l'envoi");
      }
      const ok = await res.json().catch(() => ({}));
      if (ok?.from) setResolvedFrom(String(ok.from));
      const now = new Date();
      setSentAt(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      setStage("sent");
      onSent();
    } catch (err: any) {
      setErrorMsg(String(err?.message || "Échec de l'envoi"));
      setStage("error");
    }
  };

  if (stage === "sent") {
    const from = resolvedFrom || primaryFrom;
    return (
      <div className="my-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 text-xs flex items-center gap-2">
        <Check className="h-4 w-4 shrink-0 text-zinc-100" />
        <span>
          ✓ Envoyé à <strong>{draft.to.trim()}</strong> à {sentAt}
          {from ? <span className="text-zinc-400"> — depuis {from}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <div
      className="my-2 rounded-xl border border-cyan-400/30 bg-zinc-900/80 overflow-hidden"
      data-testid="inboria-draft-card"
    >
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
        <Mail className="h-3.5 w-3.5 text-cyan-300" />
        <span className="text-[11px] uppercase tracking-wide text-cyan-300 font-semibold">Brouillon prêt</span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5 text-xs">
        <div className="flex gap-2">
          <span className="text-zinc-500 w-12 shrink-0">À</span>
          <span className={cn("break-all", toValid ? "text-zinc-100" : "text-zinc-300 underline decoration-dotted")}>{draft.to.trim() || "(vide)"}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 w-12 shrink-0">Objet</span>
          <span className="text-zinc-100 break-words">{draft.subject || "(sans objet)"}</span>
        </div>
        <div className="pt-1.5 border-t border-zinc-800/70">
          <pre className="text-zinc-300 text-xs whitespace-pre-wrap break-words font-sans max-h-32 overflow-y-auto">
            {draft.body}
          </pre>
        </div>
      </div>
      {blockReason && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-200 text-[11px] flex gap-2 items-start">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{blockReason}</span>
        </div>
      )}
      {stage === "error" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-200 text-[11px] flex gap-2 items-start">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {stage === "confirm" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-300 text-[11px] space-y-2">
          <div>
            Envoyer ce mail&nbsp;?<br />
            <span className="text-zinc-400">De&nbsp;:</span>{" "}
            <strong className="text-zinc-100">{primaryFrom || "votre boîte principale"}</strong>{" "}
            <span className="text-zinc-400">→ À&nbsp;:</span>{" "}
            <strong className="text-zinc-100">{draft.to.trim()}</strong>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 flex-1" onClick={doSend} data-testid="inboria-draft-confirm">
              Confirmer l'envoi
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400" onClick={() => setStage("idle")}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {(stage === "idle" || stage === "error") && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/60 flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 flex-1 disabled:opacity-50"
            onClick={() => setStage("confirm")}
            disabled={!toValid}
            data-testid="inboria-draft-send"
          >
            <Send className="h-3 w-3 mr-1" />
            Envoyer
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            onClick={() => onEdit(draft)}
            data-testid="inboria-draft-edit"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Modifier
          </Button>
        </div>
      )}
      {stage === "sending" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-center text-xs text-zinc-300 gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Envoi en cours…
        </div>
      )}
    </div>
  );
});

interface MeetingCardProps {
  meeting: InboriaMeeting;
  accessToken: string;
  baseUrl: string;
  lang: string;
  connections: Array<{ id: string; email_address: string }>;
  defaultConnectionId: string;
  onSent: () => void;
}

const MeetingProposalCard = memo(function MeetingProposalCard({
  meeting,
  accessToken,
  baseUrl,
  lang,
  connections,
  defaultConnectionId,
  onSent,
}: MeetingCardProps) {
  const [stage, setStage] = useState<"idle" | "confirm" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fromConnectionId, setFromConnectionId] = useState<string>(defaultConnectionId);
  // `connectionsData` peut être chargé APRES le 1er render de la carte : on
  // resynchronise alors fromConnectionId si l'utilisateur n'a pas encore
  // touché au sélecteur (= il vaut encore "" ou un id absent de la liste).
  useEffect(() => {
    if (!defaultConnectionId) return;
    if (!fromConnectionId || !connections.some((c) => c.id === fromConnectionId)) {
      setFromConnectionId(defaultConnectionId);
    }
  }, [defaultConnectionId, connections, fromConnectionId]);
  const fromEmail = connections.find((c) => c.id === fromConnectionId)?.email_address || "";

  const toValid = EMAIL_RE.test(meeting.to.trim());
  const startDate = meeting.startAt ? new Date(meeting.startAt) : null;
  const endDate = meeting.endAt ? new Date(meeting.endAt) : null;
  const dateValid = !!(startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate > startDate);
  const blockReason = !toValid
    ? "Adresse destinataire invalide ou manquante."
    : !dateValid
      ? "Créneau invalide."
      : "";
  const slotLabel = dateValid && startDate && endDate
    ? `${startDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} ${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "(créneau invalide)";

  const doSend = async () => {
    setStage("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`${baseUrl}/api/appointments/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          to: meeting.to.trim(),
          contactName: meeting.contactName || undefined,
          subject: meeting.subject || "Rendez-vous",
          startAt: meeting.startAt,
          endAt: meeting.endAt,
          location: meeting.location || undefined,
          lang,
          fromConnectionId: fromConnectionId || undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Échec de l'envoi");
      }
      setStage("sent");
      onSent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de l'envoi";
      setErrorMsg(msg);
      setStage("error");
    }
  };

  if (stage === "sent") {
    return (
      <div className="my-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 text-xs flex items-center gap-2">
        <Check className="h-4 w-4 shrink-0 text-zinc-100" />
        <span>
          Proposition envoyée à <strong>{meeting.contactName || meeting.to.trim()}</strong>. Inboria détectera la réponse automatiquement.
        </span>
      </div>
    );
  }

  return (
    <div
      className="my-2 rounded-xl border border-cyan-400/30 bg-zinc-900/80 overflow-hidden"
      data-testid="inboria-meeting-card"
    >
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-cyan-300" />
        <span className="text-[11px] uppercase tracking-wide text-cyan-300 font-semibold">
          Proposition de rendez-vous
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5 text-xs">
        <div className="flex gap-2 items-center">
          <span className="text-zinc-500 w-16 shrink-0">De</span>
          {connections.length > 1 ? (
            <select
              value={fromConnectionId}
              onChange={(e) => setFromConnectionId(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-100 text-xs flex-1 min-w-0"
              data-testid="inboria-meeting-from"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.email_address}</option>
              ))}
            </select>
          ) : (
            <span className="text-zinc-100 break-all">{fromEmail || "(aucun compte)"}</span>
          )}
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 w-16 shrink-0">À</span>
          <span className={cn("break-all", toValid ? "text-zinc-100" : "text-zinc-300 underline decoration-dotted")}>
            {meeting.contactName ? `${meeting.contactName} <${meeting.to.trim()}>` : meeting.to.trim() || "(vide)"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 w-16 shrink-0">Objet</span>
          <span className="text-zinc-100 break-words">{meeting.subject || "(sans objet)"}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 w-16 shrink-0">Créneau</span>
          <span className={cn(dateValid ? "text-zinc-100" : "text-zinc-300 underline decoration-dotted")}>{slotLabel}</span>
        </div>
        {meeting.location && (
          <div className="flex gap-2">
            <span className="text-zinc-500 w-16 shrink-0 flex items-center gap-1">
              <MapPin className="h-3 w-3" />Lieu
            </span>
            <span className="text-zinc-100 break-words">{meeting.location}</span>
          </div>
        )}
      </div>
      {blockReason && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-200 text-[11px] flex gap-2 items-start">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{blockReason}</span>
        </div>
      )}
      {stage === "error" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-200 text-[11px] flex gap-2 items-start">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {stage === "confirm" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-300 text-[11px] space-y-2">
          <div>Inboria va envoyer la proposition à <strong className="text-zinc-100">{meeting.to.trim()}</strong> et créer un RDV en attente. Confirmer ?</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 flex-1"
              onClick={doSend}
              data-testid="inboria-meeting-confirm"
            >
              Confirmer l'envoi
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400" onClick={() => setStage("idle")}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {(stage === "idle" || stage === "error") && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/60 flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 flex-1 disabled:opacity-50"
            onClick={() => setStage("confirm")}
            disabled={!toValid || !dateValid}
            data-testid="inboria-meeting-send"
          >
            <Send className="h-3 w-3 mr-1" />
            Envoyer la proposition
          </Button>
        </div>
      )}
      {stage === "sending" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-center text-xs text-zinc-300 gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Envoi en cours…
        </div>
      )}
    </div>
  );
});

interface MultiMeetingCardProps {
  multi: InboriaMultiMeeting;
  accessToken: string;
  baseUrl: string;
  lang: string;
  connections: Array<{ id: string; email_address: string }>;
  defaultConnectionId: string;
  onSent: () => void;
}

const MultiMeetingProposalCard = memo(function MultiMeetingProposalCard({
  multi,
  accessToken,
  baseUrl,
  lang,
  connections,
  defaultConnectionId,
  onSent,
}: MultiMeetingCardProps) {
  const [stage, setStage] = useState<"idle" | "confirm" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fromConnectionId, setFromConnectionId] = useState<string>(defaultConnectionId);
  useEffect(() => {
    if (!defaultConnectionId) return;
    if (!fromConnectionId || !connections.some((c) => c.id === fromConnectionId)) {
      setFromConnectionId(defaultConnectionId);
    }
  }, [defaultConnectionId, connections, fromConnectionId]);
  const fromEmail = connections.find((c) => c.id === fromConnectionId)?.email_address || "";

  const toValid = EMAIL_RE.test(multi.to.trim());
  const slotsValid = multi.slots.every((s) => {
    const sd = new Date(s.startAt);
    const ed = new Date(s.endAt);
    return !isNaN(sd.getTime()) && !isNaN(ed.getTime()) && ed > sd;
  });
  const blockReason = !toValid
    ? "Adresse destinataire invalide ou manquante."
    : !slotsValid
      ? "Un des créneaux est invalide."
      : "";

  const fmtSlot = (s: { startAt: string; endAt: string }) => {
    const sd = new Date(s.startAt);
    const ed = new Date(s.endAt);
    return `${sd.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} ${sd.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${ed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const doSend = async () => {
    setStage("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`${baseUrl}/api/appointments/propose-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          to: multi.to.trim(),
          contactName: multi.contactName || undefined,
          subject: multi.subject || "Rendez-vous",
          location: multi.location || undefined,
          lang,
          slots: multi.slots,
          fromConnectionId: fromConnectionId || undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const code = errBody?.error || "";
        const friendly =
          code === "all_slots_conflict"
            ? "Tous les créneaux proposés chevauchent un RDV existant — impossible d'envoyer."
            : code === "invalid_payload"
              ? "Payload invalide (créneaux mal formés ou >8 créneaux)."
              : code || "Échec de l'envoi";
        throw new Error(friendly);
      }
      setStage("sent");
      onSent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de l'envoi";
      setErrorMsg(msg);
      setStage("error");
    }
  };

  if (stage === "sent") {
    return (
      <div className="my-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 text-xs flex items-center gap-2">
        <Check className="h-4 w-4 shrink-0 text-zinc-100" />
        <span>
          {multi.slots.length} propositions envoyées à <strong>{multi.contactName || multi.to.trim()}</strong>. Inboria identifiera le créneau choisi automatiquement.
        </span>
      </div>
    );
  }

  return (
    <div
      className="my-2 rounded-xl border border-cyan-400/30 bg-zinc-900/80 overflow-hidden"
      data-testid="inboria-multi-meeting-card"
    >
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-cyan-300" />
        <span className="text-[11px] uppercase tracking-wide text-cyan-300 font-semibold">
          {multi.slots.length} créneaux à proposer
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5 text-xs">
        <div className="flex gap-2 items-center">
          <span className="text-zinc-500 w-16 shrink-0">De</span>
          {connections.length > 1 ? (
            <select
              value={fromConnectionId}
              onChange={(e) => setFromConnectionId(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-100 text-xs flex-1 min-w-0"
              data-testid="inboria-multi-meeting-from"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.email_address}</option>
              ))}
            </select>
          ) : (
            <span className="text-zinc-100 break-all">{fromEmail || "(aucun compte)"}</span>
          )}
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 w-16 shrink-0">À</span>
          <span className={cn("break-all", toValid ? "text-zinc-100" : "text-zinc-300 underline decoration-dotted")}>
            {multi.contactName ? `${multi.contactName} <${multi.to.trim()}>` : multi.to.trim() || "(vide)"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 w-16 shrink-0">Objet</span>
          <span className="text-zinc-100 break-words">{multi.subject || "(sans objet)"}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-zinc-500 w-16 shrink-0">Créneaux</span>
          <ul className="text-zinc-100 space-y-0.5 list-disc list-inside">
            {multi.slots.map((s, i) => (
              <li key={i} className="break-words">{fmtSlot(s)}</li>
            ))}
          </ul>
        </div>
        {multi.location && (
          <div className="flex gap-2">
            <span className="text-zinc-500 w-16 shrink-0 flex items-center gap-1">
              <MapPin className="h-3 w-3" />Lieu
            </span>
            <span className="text-zinc-100 break-words">{multi.location}</span>
          </div>
        )}
      </div>
      {blockReason && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-200 text-[11px] flex gap-2 items-start">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{blockReason}</span>
        </div>
      )}
      {stage === "error" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-200 text-[11px] flex gap-2 items-start">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {stage === "confirm" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900 text-zinc-300 text-[11px] space-y-2">
          <div>Inboria va envoyer UN mail listant les {multi.slots.length} créneaux à <strong className="text-zinc-100">{multi.to.trim()}</strong>. Confirmer ?</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 flex-1"
              onClick={doSend}
              data-testid="inboria-multi-meeting-confirm"
            >
              Confirmer l'envoi
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400" onClick={() => setStage("idle")}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {(stage === "idle" || stage === "error") && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/60 flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 flex-1 disabled:opacity-50"
            onClick={() => setStage("confirm")}
            disabled={!toValid || !slotsValid}
            data-testid="inboria-multi-meeting-send"
          >
            <Send className="h-3 w-3 mr-1" />
            Envoyer les {multi.slots.length} propositions
          </Button>
        </div>
      )}
      {stage === "sending" && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-center text-xs text-zinc-300 gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Envoi en cours…
        </div>
      )}
    </div>
  );
});

export function InboriaChatButton() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Resoudre la connexion principale d'envoi (= la plus saine, la plus
  // ancienne) pour pouvoir afficher "De: <adresse>" dans la mini-confirmation
  // avant l'envoi du brouillon.
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: connectionsData } = useQuery<Array<{ id: string; email_address: string; consecutive_failures?: number | null }>>({
    queryKey: ["inboria-chat-primary-connection"],
    enabled: isOpen && !!session?.access_token,
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/email/connections`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!res.ok) return [];
      return (await res.json()) as Array<{ id: string; email_address: string; consecutive_failures?: number | null }>;
    },
    staleTime: 60_000,
  });
  const primaryConnection = (() => {
    const list = connectionsData || [];
    if (list.length === 0) return null;
    const healthy = list.filter((c) => !c.consecutive_failures || Number(c.consecutive_failures) === 0);
    return healthy[0] || list[0] || null;
  })();
  const primaryFrom = primaryConnection?.email_address || "";
  const primaryConnectionId = primaryConnection?.id || "";

  const openComposeWithDraft = useCallback(
    (d: InboriaDraft) => {
      try {
        sessionStorage.setItem(
          "inboria.compose.prefill",
          JSON.stringify({ to: d.to, subject: d.subject, body: d.body }),
        );
      } catch {
        /* noop */
      }
      setIsOpen(false);
      // Si on est deja sur /dashboard, un changement de query string ne
      // remonte pas la page : on emet un event custom que le dashboard
      // ecoute pour consommer le prefill et ouvrir le composer. Sinon, on
      // navigue vers /dashboard?compose=1 et l'effet de mount fera le job.
      try {
        const onDashboard =
          typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "").endsWith("/dashboard");
        if (onDashboard) {
          window.dispatchEvent(new CustomEvent("inboria-open-compose"));
          return;
        }
      } catch {
        /* noop */
      }
      setLocation("/dashboard?compose=1");
    },
    [setLocation],
  );


  const openMail = useCallback(
    (id: number) => {
      // Inboria chat → ouverture directe du mail dans le tableau de bord.
      // 1) Si on est déjà sur /dashboard, un événement custom indique au
      //    dashboard d'ouvrir l'email (plus fiable que d'écouter les
      //    changements de query string avec wouter v3).
      // 2) Sinon, on navigue vers /dashboard?emailId=X et l'init du
      //    state via URL fait le travail.
      try {
        window.dispatchEvent(
          new CustomEvent("inboria-open-mail", { detail: { id } }),
        );
      } catch {}
      setLocation(`/dashboard?emailId=${id}`);
      setIsOpen(false);
    },
    [setLocation],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    const consumePrefill = () => {
      try {
        const raw = sessionStorage.getItem("inboria.chat.prefill");
        if (raw) {
          sessionStorage.removeItem("inboria.chat.prefill");
          setIsOpen(true);
          setInput(raw);
          setTimeout(() => textareaRef.current?.focus(), 80);
        }
      } catch {
        /* noop */
      }
    };
    consumePrefill();
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: string }>).detail;
      setIsOpen(true);
      if (detail?.prefill) {
        setInput(detail.prefill);
        setTimeout(() => textareaRef.current?.focus(), 80);
      } else {
        consumePrefill();
      }
    };
    window.addEventListener("inboria-open-chat", onOpen as EventListener);
    return () => window.removeEventListener("inboria-open-chat", onOpen as EventListener);
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !session?.access_token) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const body: Record<string, unknown> = {
        messages: nextMessages.slice(-20),
      };
      const res = await fetch(`${baseUrl}/api/inboria/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "request failed");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "" }]);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    } catch (err: any) {
      const isQuota = err?.message && /quota|crédit|credit/i.test(String(err.message));
      const errorMsg = isQuota ? t("inboriaChat.errorQuota") : t("inboriaChat.errorGeneric");
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      toast({ title: errorMsg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => setMessages([]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 gap-2 px-2.5 hover:bg-cyan-500/10 text-zinc-200"
        aria-label={t("inboriaChat.openLabel")}
        data-testid="inboria-chat-button"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-cyan-500/15 border border-cyan-400/30">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        </span>
        <span className="text-sm font-medium">
          {t("inbox.askInboria", "Demander à Inboria")}
        </span>
      </Button>
      {isOpen && createPortal(
        <>
          <div
            className="fixed inset-0 z-[99] bg-black/30"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-y-0 right-0 z-[100] h-full w-full sm:max-w-md border-l border-zinc-800 bg-zinc-950 p-0 shadow-2xl flex flex-col gap-0"
            role="dialog"
            aria-modal="false"
            data-inboria-chat-panel
          >
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 leading-tight">
                Inbor<span className="text-cyan-400">ia</span>
              </h2>
              <p className="text-xs text-zinc-500 leading-tight">{t("inboriaChat.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearConversation}
                className="text-xs text-zinc-400 hover:text-zinc-100 h-7"
              >
                {t("inboriaChat.clear")}
              </Button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t("common.close", "Fermer")}
              className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              data-testid="inboria-chat-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="h-12 w-12 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-cyan-300" />
              </div>
              <p className="text-sm font-medium text-zinc-200">
                {t("inboriaChat.greetingTitle")}
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                {t("inboriaChat.greetingDesc")}
              </p>
              <div className="mt-5 w-full space-y-2">
                {[
                  t("inboriaChat.suggest1"),
                  t("inboriaChat.suggest2"),
                  t("inboriaChat.suggest3"),
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 shrink-0 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-cyan-600 text-white rounded-br-sm"
                    : "bg-zinc-800 text-zinc-100 rounded-bl-sm",
                )}
              >
                {m.role === "assistant" ? (() => {
                  const segments = extractMeetings(m.content);
                  if (segments.length > 0) {
                    return (
                      <div className="space-y-2">
                        {segments.map((seg, i) => {
                          if (seg.kind === "text") {
                            return <div key={`t-${i}`}>{renderAssistantContent(seg.text, openMail)}</div>;
                          }
                          if (!session?.access_token) return null;
                          if (seg.kind === "multi") {
                            return (
                              <MultiMeetingProposalCard
                                key={`mm-${i}`}
                                multi={seg.multi}
                                accessToken={session.access_token}
                                baseUrl={baseUrl}
                                lang={(typeof window !== "undefined" && window.navigator?.language?.slice(0, 2)) || "fr"}
                                connections={connectionsData || []}
                                defaultConnectionId={primaryConnectionId}
                                onSent={() => {
                                  toast({ title: "Propositions envoyées" });
                                  queryClient.invalidateQueries({ queryKey: ["appointments"] });
                                }}
                              />
                            );
                          }
                          return (
                            <MeetingProposalCard
                              key={`m-${i}`}
                              meeting={seg.meeting}
                              accessToken={session.access_token}
                              baseUrl={baseUrl}
                              lang={(typeof window !== "undefined" && window.navigator?.language?.slice(0, 2)) || "fr"}
                              connections={connectionsData || []}
                              defaultConnectionId={primaryConnectionId}
                              onSent={() => {
                                toast({ title: "Proposition envoyée" });
                                queryClient.invalidateQueries({ queryKey: ["appointments"] });
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  }
                  const { draft, before, after } = extractDraft(m.content);
                  if (!draft) return renderAssistantContent(m.content, openMail);
                  return (
                    <>
                      {before && <div>{renderAssistantContent(before, openMail)}</div>}
                      {session?.access_token && (
                        <DraftCard
                          draft={draft}
                          accessToken={session.access_token}
                          baseUrl={baseUrl}
                          primaryFrom={primaryFrom}
                          onEdit={openComposeWithDraft}
                          onSent={() => {
                            toast({ title: "Mail envoyé" });
                          }}
                        />
                      )}
                      {after && <div>{renderAssistantContent(after, openMail)}</div>}
                    </>
                  );
                })() : m.content}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-zinc-200" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="h-7 w-7 shrink-0 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="bg-zinc-800 text-zinc-300 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("inboriaChat.thinking")}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("inboriaChat.inputPlaceholder")}
              rows={2}
              className="resize-none bg-zinc-900 border-zinc-800 text-sm min-h-[60px] max-h-[160px]"
              disabled={isLoading}
              data-testid="inboria-chat-input"
            />
            <Button
              type="button"
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 h-9 w-9 shrink-0"
              data-testid="inboria-chat-send"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5 text-center">
            {t("inboriaChat.footerHint")}
          </p>
        </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
