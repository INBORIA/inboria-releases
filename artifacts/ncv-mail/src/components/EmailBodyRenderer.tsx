import { useRef, useEffect, useState, useMemo, type ReactNode } from "react";

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

function htmlToReadableText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, head, title, meta, link, noscript").forEach((el) => el.remove());
    doc.querySelectorAll("[hidden], [aria-hidden='true']").forEach((el) => el.remove());
    doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
    doc.querySelectorAll("p, div, tr, li, h1, h2, h3, h4, h5, h6").forEach((el) => {
      el.append("\n");
    });
    const text = (doc.body?.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return text;
  } catch {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function renderTextWithLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(https?:\/\/[^\s<>]+|[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const m = match[0];
    const href = m.includes("@") ? `mailto:${m}` : m;
    parts.push(
      <a key={`l${key++}`} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
        {m}
      </a>,
    );
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

interface EmailBodyRendererProps {
  body?: string | null;
  emailId?: number | string;
  sender?: string;
}

export function EmailBodyRenderer({ body, emailId, sender }: EmailBodyRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(200);
  const [renderFailed, setRenderFailed] = useState(false);

  const content = useMemo(() => cleanEmailBody(body || ""), [body]);
  const html = isHtml(content);
  const fallbackText = useMemo(
    () => (html ? htmlToReadableText(content) : content),
    [html, content],
  );

  useEffect(() => {
    setRenderFailed(false);
  }, [body, emailId]);

  useEffect(() => {
    if (!html || !iframeRef.current || renderFailed) return;

    const iframe = iframeRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    const imageListeners: Array<{ img: HTMLImageElement; fn: () => void }> = [];
    const timers: number[] = [];
    let measuredOk = false;

    const measure = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) return;
        const h = Math.max(
          doc.body.scrollHeight,
          doc.documentElement?.scrollHeight || 0,
          doc.body.getBoundingClientRect().height,
        );
        if (h > 0) {
          setIframeHeight(Math.ceil(h) + 16);
          if (h >= 30) measuredOk = true;
        }
      } catch {}
    };

    const reportFailure = (reason: string) => {
      try {
        const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
        fetch(`${apiBase}/api/render-failures`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            emailId: emailId ?? null,
            sender: sender ?? null,
            reason,
            bodyLength: (body || "").length,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    const checkRendered = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        const innerText = (doc?.body?.innerText || "").trim();
        const h = doc?.body?.scrollHeight || 0;
        const looksEmpty = h < 30 || innerText.length < 5;
        if (looksEmpty && !measuredOk) {
          setRenderFailed(true);
          reportFailure(`empty_render h=${h} text=${innerText.length}`);
        }
      } catch (err) {
        setRenderFailed(true);
        reportFailure(`exception ${(err as Error)?.message || ""}`);
      }
    };

    const wireImages = (doc: Document) => {
      const imgs = Array.from(doc.images);
      for (const img of imgs) {
        if (img.complete) continue;
        const fn = () => measure();
        img.addEventListener("load", fn);
        img.addEventListener("error", fn);
        imageListeners.push({ img, fn });
      }
    };

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) return;

        try {
          const existing = doc.getElementById("ncvmail-overrides-late");
          if (existing) existing.remove();
          const overrideTag = doc.createElement("style");
          overrideTag.id = "ncvmail-overrides-late";
          overrideTag.textContent = `
            html, body {
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
              width: auto !important;
              max-width: 100% !important;
            }
            img { max-width: 100% !important; height: auto !important; }
            table { max-width: 100% !important; }
          `;
          (doc.head || doc.documentElement).appendChild(overrideTag);
        } catch {}

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => measure());
          resizeObserver.observe(doc.body);
          if (doc.documentElement) resizeObserver.observe(doc.documentElement);
        }

        mutationObserver = new MutationObserver(() => {
          wireImages(doc);
          measure();
        });
        mutationObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });

        wireImages(doc);
      } catch {}

      measure();
      timers.push(window.setTimeout(measure, 250));
      timers.push(window.setTimeout(measure, 1000));
      timers.push(window.setTimeout(measure, 3000));
      timers.push(window.setTimeout(checkRendered, 3500));
    };

    iframe.addEventListener("load", handleLoad);
    const safetyTimer = window.setTimeout(() => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) {
          setRenderFailed(true);
          reportFailure("no_document_after_5s");
        }
      } catch {
        setRenderFailed(true);
        reportFailure("safety_timer_exception");
      }
    }, 5000);
    timers.push(safetyTimer);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      for (const { img, fn } of imageListeners) {
        img.removeEventListener("load", fn);
        img.removeEventListener("error", fn);
      }
      for (const t of timers) clearTimeout(t);
    };
  }, [html, content, renderFailed, body, emailId, sender]);

  if (!content) {
    return (
      <p className="text-[13px] text-white/50 italic">(Aucun contenu disponible)</p>
    );
  }

  if (!html) {
    return (
      <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">
        {renderTextWithLinks(content)}
      </p>
    );
  }

  if (renderFailed) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-white/40 italic">Affichage simplifié</p>
        <div className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap break-words">
          {fallbackText
            ? renderTextWithLinks(fallbackText)
            : <span className="text-white/40 italic">(Contenu indisponible)</span>}
        </div>
      </div>
    );
  }

  const hasDarkTextColors = /color\s*:\s*#[0-4][0-9a-f]{2}[0-9a-f]{3}\b/i.test(content) ||
    /color\s*:\s*#[0-4][0-9a-f]{2}\b/i.test(content) ||
    /color\s*:\s*(?:black|#000|rgb\s*\(\s*0)/i.test(content) ||
    /color\s*:\s*#[0-4][0-9a-f]{5}\b/i.test(content);

  const isFullHtmlDoc = /<!DOCTYPE/i.test(content) || /<html[\s>]/i.test(content) || /<body[\s>]/i.test(content);

  const useWhiteBg = hasDarkTextColors || isFullHtmlDoc;

  const baseStyle = `
    <style>
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
    </style>
  `;

  let wrappedHtml: string;
  if (isFullHtmlDoc) {
    wrappedHtml = content;
  } else {
    wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${baseStyle}
      </head>
      <body>${content}</body>
      </html>
    `;
  }

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
