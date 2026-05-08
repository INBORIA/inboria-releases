export const AVATAR_PALETTE = [
  { bg: "bg-blue-500/15", border: "border-blue-400/30", text: "text-blue-300" },
  { bg: "bg-purple-500/15", border: "border-purple-400/30", text: "text-purple-300" },
  { bg: "bg-emerald-500/15", border: "border-emerald-400/30", text: "text-emerald-300" },
  { bg: "bg-amber-500/15", border: "border-amber-400/30", text: "text-amber-300" },
  { bg: "bg-rose-500/15", border: "border-rose-400/30", text: "text-rose-300" },
  { bg: "bg-cyan-500/15", border: "border-cyan-400/30", text: "text-cyan-300" },
  { bg: "bg-pink-500/15", border: "border-pink-400/30", text: "text-pink-300" },
  { bg: "bg-indigo-500/15", border: "border-indigo-400/30", text: "text-indigo-300" },
] as const;

export function avatarColor(name: string | null | undefined) {
  const s = (name || "?").trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function avatarInitial(name: string | null | undefined) {
  return ((name || "?").trim()[0] || "?").toUpperCase();
}
