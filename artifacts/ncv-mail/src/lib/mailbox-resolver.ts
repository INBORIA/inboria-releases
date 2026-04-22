export interface MailboxConnection {
  id: string;
  email_address: string;
  provider?: string;
}

export interface MailboxShared {
  id: string;
  name: string;
  email_address?: string | null;
}

export interface MailboxBadge {
  key: string;
  label: string;
  shortLabel: string;
  paletteIndex: number;
  dotClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  kind: "personal" | "shared";
  isShared: boolean;
}

const PALETTE = [
  { dot: "bg-sky-400", bg: "bg-sky-500/15", text: "text-sky-300", border: "border-sky-500/25" },
  { dot: "bg-violet-400", bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/25" },
  { dot: "bg-emerald-400", bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/25" },
  { dot: "bg-amber-400", bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/25" },
  { dot: "bg-pink-400", bg: "bg-pink-500/15", text: "text-pink-300", border: "border-pink-500/25" },
  { dot: "bg-cyan-400", bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/25" },
  { dot: "bg-rose-400", bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/25" },
  { dot: "bg-lime-400", bg: "bg-lime-500/15", text: "text-lime-300", border: "border-lime-500/25" },
  { dot: "bg-fuchsia-400", bg: "bg-fuchsia-500/15", text: "text-fuchsia-300", border: "border-fuchsia-500/25" },
  { dot: "bg-teal-400", bg: "bg-teal-500/15", text: "text-teal-300", border: "border-teal-500/25" },
];

function hashString(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function extractAddresses(value: string | null | undefined): string[] {
  if (!value) return [];
  const parts = String(value).split(/[,;]/);
  const out: string[] = [];
  for (const raw of parts) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const angle = trimmed.match(/<([^>]+)>/);
    const candidate = (angle ? angle[1] : trimmed).trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+$/.test(candidate)) {
      out.push(candidate);
    }
  }
  return out;
}

export function recipientMatchesAddress(recipient: string | null | undefined, address: string | null | undefined): boolean {
  if (!recipient || !address) return false;
  const target = address.trim().toLowerCase();
  if (!target) return false;
  return extractAddresses(recipient).includes(target);
}

function shortenEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local}@${domain.split(".")[0]}`;
}

export function resolveMailboxBadge(
  email: { recipient?: string | null; shared_mailbox_id?: string | null; sharedMailboxId?: string | null },
  connections: MailboxConnection[] | undefined,
  sharedMailboxes?: MailboxShared[] | undefined,
): MailboxBadge | null {
  const sharedId = email.shared_mailbox_id || email.sharedMailboxId || null;
  if (sharedId && sharedMailboxes && sharedMailboxes.length > 0) {
    const mb = sharedMailboxes.find((m) => String(m.id) === String(sharedId));
    if (mb) {
      const key = `shared:${mb.id}`;
      const idx = hashString(key) % PALETTE.length;
      const p = PALETTE[idx]!;
      return {
        key,
        label: mb.name || mb.email_address || "",
        shortLabel: mb.name || (mb.email_address ? shortenEmail(mb.email_address) : ""),
        paletteIndex: idx,
        dotClass: p.dot,
        bgClass: p.bg,
        textClass: p.text,
        borderClass: p.border,
        kind: "shared",
        isShared: true,
      };
    }
  }

  const recipient = (email.recipient || "").toLowerCase().trim();
  if (!recipient || !connections || connections.length === 0) return null;

  const match = connections.find((c) => (c.email_address || "").toLowerCase() === recipient);
  const target = match || null;
  if (!target) return null;

  const key = `personal:${(target.email_address || "").toLowerCase()}`;
  const idx = hashString(key) % PALETTE.length;
  const p = PALETTE[idx]!;
  return {
    key,
    label: target.email_address,
    shortLabel: shortenEmail(target.email_address),
    paletteIndex: idx,
    dotClass: p.dot,
    bgClass: p.bg,
    textClass: p.text,
    borderClass: p.border,
    kind: "personal",
    isShared: false,
  };
}
