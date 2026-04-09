import { useRef, useEffect, useState, useMemo } from "react";

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
    return atob(text.replace(/\s/g, ""));
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

  cleaned = cleaned.replace(/(&[a-z]+;|&#\d+;)/gi, (match) => {
    const el = document.createElement("span");
    el.innerHTML = match;
    return el.textContent || match;
  });

  cleaned = cleaned.replace(/(Se désabonner|Unsubscribe|Manage notification|View online|Voir en ligne)\s*:?\s*(https?:\/\/\S+|\[lien\])/gi, "");

  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");
  cleaned = cleaned.trim();

  return cleaned;
}

export function cleanEmailBody(raw: string): string {
  if (!raw) return "";

  if (isHtml(raw) && !raw.trimStart().startsWith("Content-Type:") && !raw.trimStart().startsWith("MIME-Version:")) {
    return raw;
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

export function EmailBodyRenderer({ body }: { body?: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(200);

  const content = useMemo(() => cleanEmailBody(body || ""), [body]);
  const html = isHtml(content);

  useEffect(() => {
    if (!html || !iframeRef.current) return;

    const iframe = iframeRef.current;

    const updateHeight = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          const h = doc.body.scrollHeight;
          if (h > 0) setIframeHeight(h + 16);
        }
      } catch {}
    };

    const handleLoad = () => {
      updateHeight();
      const interval = setInterval(updateHeight, 500);
      setTimeout(() => clearInterval(interval), 5000);
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [html, content]);

  if (!content) {
    return (
      <p className="text-[13px] text-white/50 italic">(Aucun contenu disponible)</p>
    );
  }

  if (!html) {
    return (
      <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    );
  }

  const wrappedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(255,255,255,0.8);
          background: transparent;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        a { color: #2d7dd2; }
        img { max-width: 100%; height: auto; }
        table { max-width: 100% !important; }
        pre, code { white-space: pre-wrap; word-wrap: break-word; }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      sandbox="allow-same-origin"
      style={{
        width: "100%",
        height: iframeHeight,
        border: "none",
        background: "transparent",
        display: "block",
      }}
      title="Contenu de l'email"
    />
  );
}
