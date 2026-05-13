// Détection + réparation du double/triple-encodage UTF-8 (mojibake).
// Cause classique : des bytes UTF-8 sont décodés comme Latin-1 (ou Windows-1252)
// puis ré-encodés en UTF-8. Ex. "–" (U+2013) → "Ã¢Â€Â\"".
//
// Contrairement à un simple Buffer.from(s,'latin1'), on doit gérer les chars
// Windows-1252 (€, ", ', –, etc.) qui ont une codepoint > 255 mais
// proviennent en réalité d'un seul byte 0x80..0x9F. On reconstruit les bytes
// en mappant ces chars vers leur byte d'origine, puis on décode en UTF-8.
// On itère (max 3 passes) tant que la repair raccourcit la string et n'introduit
// pas U+FFFD.

const WIN1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

// Détection : soit un char latin-1 haut suivi d'un C1/continuation byte,
// soit la présence d'un char dans la zone C1 (U+0080..U+009F) qui n'apparaît
// quasi jamais dans du texte normal — signal très fort de mojibake.
const MOJIBAKE_PATTERN = /[\u00C0-\u00FF][\u0080-\u00BF]|[\u0080-\u009F]/;

// Vrai si le codepoint est représentable comme un byte unique pour le round-trip
// (Latin-1 direct ou char Windows-1252 mappé). Sinon le char est "safe" (emoji,
// CJK, etc.) et doit être préservé tel quel.
function isByteLike(cp: number): boolean {
  return cp <= 0xff || WIN1252_TO_BYTE[cp] !== undefined;
}

function decodeRun(run: string): string | null {
  if (!MOJIBAKE_PATTERN.test(run)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < run.length; i++) {
    const cp = run.codePointAt(i)!;
    if (cp > 0xffff) i++;
    if (cp <= 0xff) bytes.push(cp);
    else if (WIN1252_TO_BYTE[cp] !== undefined) bytes.push(WIN1252_TO_BYTE[cp]);
    else return null;
  }
  try {
    const decoded = Buffer.from(bytes).toString("utf8");
    if (decoded.includes("\uFFFD")) return null;
    if (decoded.length >= run.length) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Découpe la string en runs de chars "byte-like" séparés par des chars safe
// (emoji, CJK, etc.) et tente de décoder chaque run indépendamment.
function repairOnce(s: string): string {
  let out = "";
  let buf = "";
  let changed = false;
  const flush = () => {
    if (!buf) return;
    const fixed = decodeRun(buf);
    if (fixed !== null) {
      out += fixed;
      changed = true;
    } else {
      out += buf;
    }
    buf = "";
  };
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i)!;
    const wide = cp > 0xffff;
    if (isByteLike(cp)) {
      buf += s[i];
      if (wide) buf += s[i + 1];
    } else {
      flush();
      out += s[i];
      if (wide) out += s[i + 1];
    }
    if (wide) i++;
  }
  flush();
  return changed ? out : s;
}

export function repairMojibake(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) {
    return typeof input === "string" ? input : "";
  }
  let current = input;
  for (let i = 0; i < 3; i++) {
    if (!MOJIBAKE_PATTERN.test(current)) break;
    const next = repairOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}
