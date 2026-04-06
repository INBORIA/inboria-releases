import { useRef, useEffect, useState, useMemo } from "react";

function isHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

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
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
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

  decoded = decoded.replace(/\s{3,}/g, "\n\n");
  decoded = decoded.trim();

  return decoded;
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
  if (hasMimeArtifacts(raw)) {
    return cleanPlainText(stripMimeArtifacts(raw));
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
