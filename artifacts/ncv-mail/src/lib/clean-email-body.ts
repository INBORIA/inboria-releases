const HTML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00A0",
  copy: "\u00A9", reg: "\u00AE", trade: "\u2122",
  hellip: "\u2026", mdash: "\u2014", ndash: "\u2013",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D",
  laquo: "\u00AB", raquo: "\u00BB",
  bull: "\u2022", middot: "\u00B7", sect: "\u00A7",
  euro: "\u20AC", pound: "\u00A3", yen: "\u00A5", cent: "\u00A2",
  deg: "\u00B0", plusmn: "\u00B1", times: "\u00D7", divide: "\u00F7",
  iexcl: "\u00A1", iquest: "\u00BF", para: "\u00B6",
  uarr: "\u2191", darr: "\u2193", larr: "\u2190", rarr: "\u2192",
  agrave: "\u00E0", acirc: "\u00E2", auml: "\u00E4", aring: "\u00E5", aelig: "\u00E6",
  Agrave: "\u00C0", Acirc: "\u00C2", Auml: "\u00C4", Aring: "\u00C5", AElig: "\u00C6",
  ccedil: "\u00E7", Ccedil: "\u00C7",
  egrave: "\u00E8", eacute: "\u00E9", ecirc: "\u00EA", euml: "\u00EB",
  Egrave: "\u00C8", Eacute: "\u00C9", Ecirc: "\u00CA", Euml: "\u00CB",
  igrave: "\u00EC", iacute: "\u00ED", icirc: "\u00EE", iuml: "\u00EF",
  Igrave: "\u00CC", Iacute: "\u00CD", Icirc: "\u00CE", Iuml: "\u00CF",
  ograve: "\u00F2", oacute: "\u00F3", ocirc: "\u00F4", ouml: "\u00F6", otilde: "\u00F5", oslash: "\u00F8",
  Ograve: "\u00D2", Oacute: "\u00D3", Ocirc: "\u00D4", Ouml: "\u00D6", Otilde: "\u00D5", Oslash: "\u00D8",
  ugrave: "\u00F9", uacute: "\u00FA", ucirc: "\u00FB", uuml: "\u00FC",
  Ugrave: "\u00D9", Uacute: "\u00DA", Ucirc: "\u00DB", Uuml: "\u00DC",
  ntilde: "\u00F1", Ntilde: "\u00D1",
  szlig: "\u00DF", yuml: "\u00FF",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-zA-Z]+));/g, (match, hex: string | undefined, dec: string | undefined, named: string | undefined) => {
    try {
      if (hex) {
        const code = parseInt(hex, 16);
        if (Number.isFinite(code) && code > 0 && code <= 0x10FFFF) return String.fromCodePoint(code);
      }
      if (dec) {
        const code = parseInt(dec, 10);
        if (Number.isFinite(code) && code > 0 && code <= 0x10FFFF) return String.fromCodePoint(code);
      }
      if (named && HTML_ENTITIES[named]) return HTML_ENTITIES[named];
    } catch {}
    return match;
  });
}

function isHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function hasMimeArtifacts(text: string): boolean {
  return /------=_Part_/i.test(text) ||
    /Content-Type:\s*text\//i.test(text) ||
    /Content-Transfer-Encoding:\s*(quoted-printable|base64)/i.test(text) ||
    /^MIME-Version:/im.test(text) ||
    /boundary=/i.test(text);
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/= /g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    });
}

function decodeBase64Content(text: string): string {
  try {
    if (typeof atob !== "undefined") return atob(text.replace(/\s/g, ""));
    return text;
  } catch {
    return text;
  }
}

function decodeUtf8Bytes(text: string): string {
  try {
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 256) {
        bytes.push(code);
      } else {
        return text;
      }
    }
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return text;
  }
}

function extractMimePart(raw: string): string {
  const boundaryMatch = raw.match(/boundary="?([^"\s;]+)"?/i);
  if (!boundaryMatch) {
    const ctMatch = raw.match(/Content-Type:\s*text\/(html|plain)[^]*?(?:\r?\n\r?\n)([\s\S]*)/i);
    if (ctMatch) {
      const encoding = raw.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1]?.toLowerCase();
      let content = ctMatch[2];
      if (encoding === "quoted-printable") {
        content = decodeQuotedPrintable(content);
        content = decodeUtf8Bytes(content);
      } else if (encoding === "base64") {
        content = decodeBase64Content(content);
      }
      return content.trim();
    }
    return "";
  }

  const boundary = boundaryMatch[1];
  const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, "g"));

  let htmlPart = "";
  let textPart = "";

  for (const part of parts) {
    if (part.trim() === "--" || !part.trim()) continue;

    const ctypeMatch = part.match(/Content-Type:\s*text\/(html|plain)\b/i);
    if (!ctypeMatch) {
      const nestedBoundary = part.match(/boundary="?([^"\s;]+)"?/i);
      if (nestedBoundary) {
        const nested = extractMimePart(part);
        if (nested) return nested;
      }
      continue;
    }

    const type = ctypeMatch[1].toLowerCase();
    const encoding = part.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1]?.toLowerCase();

    const headerEnd = part.search(/\r?\n\r?\n/);
    if (headerEnd === -1) continue;
    let content = part.slice(headerEnd).replace(/^\r?\n\r?\n/, "");

    content = content.replace(/--\s*$/, "").trim();

    if (encoding === "quoted-printable") {
      content = decodeQuotedPrintable(content);
      content = decodeUtf8Bytes(content);
    } else if (encoding === "base64") {
      content = decodeBase64Content(content);
    }

    if (type === "html" && content.trim()) {
      htmlPart = content.trim();
    } else if (type === "plain" && content.trim()) {
      textPart = content.trim();
    }
  }

  return htmlPart || textPart;
}

function cleanPlainText(text: string): string {
  let cleaned = text;

  cleaned = cleaned.replace(/https?:\/\/[^\s)>\]]{80,}/g, "[lien]");
  cleaned = cleaned.replace(/(\[lien\]\s*){3,}/g, "[lien]\n");
  cleaned = cleaned.replace(/^[-_=]{3,}\s*$/gm, "---");
  cleaned = cleaned.replace(/\b[A-Za-z0-9+/=]{60,}\b/g, "");

  for (let i = 0; i < 5; i++) {
    const before = cleaned;
    cleaned = decodeHtmlEntities(cleaned);
    if (cleaned === before) break;
  }

  cleaned = cleaned.replace(/(Se désabonner|Unsubscribe|Manage notification|View online|Voir en ligne)\s*:?\s*(https?:\/\/\S+|\[lien\])/gi, "");

  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");
  cleaned = cleaned.trim();

  return cleaned;
}

function fixDoubleEncodedEntities(input: string): string {
  let result = input;
  for (let i = 0; i < 5; i++) {
    const before = result;
    result = result
      .replace(/&amp;#x([0-9a-f]+);/gi, "&#x$1;")
      .replace(/&amp;#(\d+);/g, "&#$1;")
      .replace(/&amp;(amp|lt|gt|quot|apos|nbsp);/gi, "&$1;");
    if (result === before) break;
  }
  return result;
}

export function cleanEmailBody(raw: string): string {
  if (!raw) return "";

  if (isHtml(raw) && !raw.trimStart().startsWith("Content-Type:") && !raw.trimStart().startsWith("MIME-Version:")) {
    return fixDoubleEncodedEntities(raw);
  }

  if (hasMimeArtifacts(raw)) {
    const extracted = extractMimePart(raw);
    if (extracted) {
      if (isHtml(extracted)) return extracted;
      return cleanPlainText(extracted);
    }
    let fallback = raw;
    fallback = fallback.replace(/------=_Part_[^\s]*/g, "");
    fallback = fallback.replace(/Content-Type:\s*[^\r\n]*/gi, "");
    fallback = fallback.replace(/Content-Transfer-Encoding:\s*\S+/gi, "");
    fallback = fallback.replace(/Content-Disposition:\s*\S+/gi, "");
    fallback = fallback.replace(/MIME-Version:\s*[\d.]+/gi, "");
    fallback = fallback.replace(/boundary="?[^\s"]*"?/gi, "");
    fallback = fallback.replace(/--\s*$/g, "");
    fallback = decodeQuotedPrintable(fallback);
    fallback = decodeUtf8Bytes(fallback);
    fallback = fallback.replace(/\s{3,}/g, "\n\n");
    fallback = fallback.trim();
    return cleanPlainText(fallback);
  }

  if (!isHtml(raw)) {
    return cleanPlainText(raw);
  }

  return raw;
}

export function isHtmlContent(text: string): boolean {
  return isHtml(text);
}

export function isHeavyBody(raw: string): boolean {
  if (!raw) return false;
  if (raw.length >= 30_000) return true;
  return /------=_Part_|Content-Type:\s*text\/|Content-Transfer-Encoding:\s*(quoted-printable|base64)|^MIME-Version:/im.test(raw);
}
