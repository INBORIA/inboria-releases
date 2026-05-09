import { randomUUID } from "node:crypto";

export interface IcsParticipant {
  email: string;
  name?: string | null;
  required?: boolean;
}

export interface IcsAppointmentInput {
  uid?: string;
  sequence?: number;
  method?: "REQUEST" | "CANCEL" | "REPLY";
  organizerEmail: string;
  organizerName?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  participants: IcsParticipant[];
  videoUrl?: string | null;
}

function fmtIcsDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error("invalid date for ICS");
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return out.join("\r\n");
}

/**
 * Génère un fichier iCalendar conforme RFC 5545 utilisable pour les
 * invitations multi-participants (METHOD:REQUEST). Joint au mail, les
 * clients standards (Gmail, Outlook, Apple Mail) affichent les boutons
 * Accepter / Refuser et envoient la réponse RSVP en METHOD:REPLY.
 */
export function buildIcs(input: IcsAppointmentInput): string {
  const uid = input.uid || `ncv-${randomUUID()}@inboria.app`;
  const dtStamp = fmtIcsDate(new Date().toISOString());
  const dtStart = fmtIcsDate(input.startAt);
  const dtEnd = fmtIcsDate(input.endAt);
  const method = input.method || "REQUEST";
  const seq = input.sequence ?? 0;

  const desc = [input.description || "", input.videoUrl ? `Lien visio : ${input.videoUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NCV Mail//Inboria//FR",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SEQUENCE:${seq}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (desc) lines.push(`DESCRIPTION:${escapeIcsText(desc)}`);
  if (input.location) lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  if (input.videoUrl) lines.push(`URL:${input.videoUrl}`);

  const orgName = input.organizerName ? `;CN=${escapeIcsText(input.organizerName)}` : "";
  lines.push(`ORGANIZER${orgName}:mailto:${input.organizerEmail}`);

  for (const p of input.participants) {
    const cn = p.name ? `;CN=${escapeIcsText(p.name)}` : "";
    const role = p.required === false ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT";
    lines.push(
      `ATTENDEE;ROLE=${role};PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:mailto:${p.email}`,
    );
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Parse minimal d'un message ICS reçu en réponse (METHOD:REPLY) pour
 * extraire le statut RSVP de l'attendee. Suffisant pour les principaux
 * clients (Gmail, Outlook, Apple Mail) qui produisent un VEVENT unique
 * avec un ATTENDEE muni de PARTSTAT.
 */
export function parseIcsReply(content: string): {
  uid: string | null;
  attendeeEmail: string | null;
  partstat: "ACCEPTED" | "DECLINED" | "TENTATIVE" | null;
} {
  const unfolded = content.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  let uid: string | null = null;
  let attendeeEmail: string | null = null;
  let partstat: "ACCEPTED" | "DECLINED" | "TENTATIVE" | null = null;

  for (const line of lines) {
    if (line.startsWith("UID:")) uid = line.slice(4).trim();
    if (line.startsWith("ATTENDEE")) {
      const mailMatch = line.match(/mailto:([^;:\s]+)/i);
      if (mailMatch && mailMatch[1]) attendeeEmail = mailMatch[1].toLowerCase();
      const ps = line.match(/PARTSTAT=([A-Z\-]+)/i);
      if (ps && ps[1]) {
        const v = ps[1].toUpperCase();
        if (v === "ACCEPTED" || v === "DECLINED" || v === "TENTATIVE") partstat = v;
      }
    }
  }
  return { uid, attendeeEmail, partstat };
}
