function hasMimeArtifacts(text: string): boolean {
  return /------=_Part_/i.test(text) ||
    /Content-Type:\s*text\//i.test(text) ||
    /Content-Transfer-Encoding:\s*(quoted-printable|base64)/i.test(text);
}

function decodeQuotedPrintableTokens(text: string): string {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/= /g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    });
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
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(new Uint8Array(bytes));
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

  let decoded = decodeQuotedPrintableTokens(text);
  decoded = decodeUtf8Bytes(decoded);

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
