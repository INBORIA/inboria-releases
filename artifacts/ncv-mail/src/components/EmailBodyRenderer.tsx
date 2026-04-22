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
    const channelId = `ncvmail-${Math.random().toString(36).slice(2)}`;
    iframe.dataset.channelId = channelId;

    const measure = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) return;
        const h = Math.max(
          doc.body.scrollHeight,
          doc.documentElement?.scrollHeight || 0,
        );
        if (h > 0) setIframeHeight(h + 16);
      } catch {}
    };

    const onMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type !== "ncvmail-resize" || e.data.channelId !== channelId) return;
      const h = Number(e.data.height);
      if (h > 0) setIframeHeight(h + 16);
    };
    window.addEventListener("message", onMessage);

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        const script = doc.createElement("script");
        script.textContent = `
          (function() {
            var channelId = ${JSON.stringify(channelId)};
            function send() {
              var h = Math.max(
                document.body ? document.body.scrollHeight : 0,
                document.documentElement ? document.documentElement.scrollHeight : 0
              );
              parent.postMessage({ type: "ncvmail-resize", channelId: channelId, height: h }, "*");
            }
            send();
            if (typeof ResizeObserver !== "undefined" && document.body) {
              new ResizeObserver(send).observe(document.body);
            }
            var imgs = document.images;
            for (var i = 0; i < imgs.length; i++) {
              if (!imgs[i].complete) {
                imgs[i].addEventListener("load", send);
                imgs[i].addEventListener("error", send);
              }
            }
            window.addEventListener("load", send);
            setTimeout(send, 250);
            setTimeout(send, 1000);
            setTimeout(send, 3000);
          })();
        `;
        doc.documentElement.appendChild(script);
      } catch {}
      measure();
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
      window.removeEventListener("message", onMessage);
    };
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

  const hasDarkTextColors = /color\s*:\s*#[0-4][0-9a-f]{2}[0-9a-f]{3}\b/i.test(content) ||
    /color\s*:\s*#[0-4][0-9a-f]{2}\b/i.test(content) ||
    /color\s*:\s*(?:black|#000|rgb\s*\(\s*0)/i.test(content) ||
    /color\s*:\s*#[0-4][0-9a-f]{5}\b/i.test(content);

  const useWhiteBg = hasDarkTextColors || /<!DOCTYPE/i.test(content);

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
          padding: ${useWhiteBg ? "12px" : "0"};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: ${useWhiteBg ? "#222" : "rgba(255,255,255,0.8)"};
          background: ${useWhiteBg ? "#ffffff" : "transparent"};
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
        border: useWhiteBg ? "1px solid rgba(255,255,255,0.1)" : "none",
        borderRadius: useWhiteBg ? "6px" : "0",
        background: useWhiteBg ? "#ffffff" : "transparent",
        display: "block",
      }}
      title="Contenu de l'email"
    />
  );
}
