function hasMimeArtifacts(text: string): boolean {
  return /------=_Part_/i.test(text) ||
    /Content-Type:\s*text\//i.test(text) ||
    /Content-Transfer-Encoding:\s*(quoted-printable|base64)/i.test(text);
}

function decodeQuotedPrintable(text: string): string {
  const lines = text.replace(/=\r?\n/g, "").replace(/= /g, "");

  const bytes: number[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i] === "=" && i + 2 < lines.length) {
      const hex = lines.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    const code = lines.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      if (bytes.length > 0) {
        // flush
      }
      bytes.push(code & 0xff);
    }
    i++;
  }

  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return text;
  }
}

function decodeBase64Segment(text: string): string {
  try {
    const cleaned = text.replace(/[^A-Za-z0-9+/=]/g, "");
    if (cleaned.length < 4) return text;
    if (typeof atob === "function") {
      const raw = atob(cleaned);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }
    return text;
  } catch {
    return text;
  }
}

function stripMimeArtifacts(raw: string): string {
  let text = raw;

  text = text.replace(/------=_Part_[^\s]*/g, "");

  text = text.replace(/Content-Type:\s*text\/[^;]*;\s*charset=[^\s]*/gi, "");
  text = text.replace(/Content-Type:\s*multipart\/[^;]*;\s*/gi, "");
  text = text.replace(/Content-Type:\s*\S+/gi, "");
  text = text.replace(/Content-Transfer-Encoding:\s*\S+/gi, "");
  text = text.replace(/Content-Disposition:\s*\S+/gi, "");

  text = text.replace(/MIME-Version:\s*[\d.]+/gi, "");
  text = text.replace(/boundary="?[^\s"]*"?/gi, "");

  text = text.replace(/--\s*$/g, "");

  let decoded = decodeQuotedPrintable(text);

  decoded = decoded.replace(/<[^>]+>/g, " ");

  decoded = decoded.replace(/\s{3,}/g, "\n\n");
  decoded = decoded.trim();

  return decoded;
}

export function cleanEmailBody(raw: string | null | undefined): string {
  if (!raw) return "";
  if (hasMimeArtifacts(raw)) {
    return stripMimeArtifacts(raw);
  }
  return raw.replace(/<[^>]+>/g, " ").replace(/\s{3,}/g, "\n\n").trim();
}
