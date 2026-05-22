import { useRef, useEffect, useState, useMemo, type ReactNode } from "react";
import { cleanEmailBody, isHtmlContent, isHeavyBody } from "@/lib/clean-email-body";
import { cleanEmailBodyAsync } from "@/lib/email-parser-client";

function isHtml(text: string): boolean {
  return isHtmlContent(text);
}

// --- Hook : décharge le parsing/decoding lourd sur un Web Worker ---
// Fast path synchrone si body court & HTML déjà propre. Sinon, on poste au
// worker pour ne pas bloquer le main thread (parsing MIME, base64, etc).
function useCleanedEmailBody(body: string | null | undefined): string {
  const raw = body || "";
  const heavy = isHeavyBody(raw);

  const fastSync = useMemo(
    () => (heavy ? "" : cleanEmailBody(raw)),
    [raw, heavy]
  );
  const [cleaned, setCleaned] = useState<string>(fastSync);

  useEffect(() => {
    if (!heavy) {
      setCleaned(cleanEmailBody(raw));
      return;
    }
    let cancelled = false;
    cleanEmailBodyAsync(raw).then((result) => {
      if (!cancelled) setCleaned(result);
    });
    return () => { cancelled = true; };
  }, [raw, heavy]);

  return cleaned;
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

const HEIGHT_CACHE_PREFIX = "ncvmail:bodyH:";

function readCachedHeight(emailId?: number | string): number | null {
  if (emailId === undefined || emailId === null) return null;
  try {
    const raw = sessionStorage.getItem(`${HEIGHT_CACHE_PREFIX}${emailId}`);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeCachedHeight(emailId: number | string | undefined, h: number) {
  if (emailId === undefined || emailId === null) return;
  try {
    sessionStorage.setItem(`${HEIGHT_CACHE_PREFIX}${emailId}`, String(h));
  } catch {}
}

function findScrollParent(el: HTMLElement | null): HTMLElement | Window {
  let cur: HTMLElement | null = el?.parentElement ?? null;
  while (cur) {
    const cs = getComputedStyle(cur);
    if (/(auto|scroll|overlay)/.test(cs.overflowY)) return cur;
    cur = cur.parentElement;
  }
  return window;
}

export function EmailBodyRenderer({ body, emailId, sender }: EmailBodyRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialHeight = useMemo(() => readCachedHeight(emailId) ?? 200, [emailId]);
  const [iframeHeight, setIframeHeight] = useState(initialHeight);
  const heightRef = useRef(initialHeight);
  const [renderFailed, setRenderFailed] = useState(false);

  const content = useCleanedEmailBody(body);
  const html = isHtml(content);
  const fallbackText = useMemo(
    () => (html ? htmlToReadableText(content) : content),
    [html, content],
  );

  useEffect(() => {
    setRenderFailed(false);
    const cached = readCachedHeight(emailId);
    if (cached) {
      heightRef.current = cached;
      setIframeHeight(cached);
    }
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
          const newH = Math.ceil(h) + 16;
          const oldH = heightRef.current;
          if (newH === oldH) {
            if (h >= 30) measuredOk = true;
            return;
          }
          const delta = newH - oldH;
          let needsCompensation = false;
          if (delta > 0) {
            try {
              const rect = iframe.getBoundingClientRect();
              const viewportH = window.innerHeight || document.documentElement.clientHeight;
              if (rect.bottom < viewportH - 4) needsCompensation = true;
            } catch {}
          }
          heightRef.current = newH;
          setIframeHeight(newH);
          if (needsCompensation) {
            const scroller = findScrollParent(iframe);
            requestAnimationFrame(() => {
              try {
                if (scroller === window) {
                  window.scrollBy(0, delta);
                } else {
                  (scroller as HTMLElement).scrollTop += delta;
                }
              } catch {}
            });
          }
          if (h >= 30) {
            measuredOk = true;
            writeCachedHeight(emailId, newH);
          }
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

  // <base target="_blank"> force tous les liens de l'email à s'ouvrir dans
  // un nouvel onglet du navigateur — sans cela, le sandbox empêche l'iframe
  // de naviguer vers une URL externe et le clic semble "ne rien faire".
  const baseStyle = `
    <base target="_blank" />
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
      a { color: #2d7dd2; cursor: pointer; }
    </style>
  `;

  let wrappedHtml: string;
  if (isFullHtmlDoc) {
    // Pour les emails livrés en document HTML complet, injecter <base> juste
    // après <head> (ou en créer un si absent) pour forcer target="_blank".
    if (/<head[\s>]/i.test(content)) {
      wrappedHtml = content.replace(/<head([^>]*)>/i, '<head$1><base target="_blank" />');
    } else if (/<html[\s>]/i.test(content)) {
      wrappedHtml = content.replace(/<html([^>]*)>/i, '<html$1><head><base target="_blank" /></head>');
    } else {
      wrappedHtml = `<head><base target="_blank" /></head>${content}`;
    }
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
      // Sandbox sécurité :
      // - allow-popups : autorise window.open / target="_blank" (sinon le
      //   clic sur un lien email est silencieusement bloqué).
      // - allow-popups-to-escape-sandbox : sans ce flag, la nouvelle fenêtre
      //   hérite du sandbox (pas de allow-scripts) et la page externe
      //   visée est cassée. Risque tabnabbing maîtrisé : l'iframe n'a pas
      //   allow-top-navigation (le parent est inviolable depuis la popup),
      //   et <base target="_blank"> déclenche noopener implicite sur les
      //   navigateurs modernes (Chrome/Firefox/Safari).
      // - PAS de allow-scripts : aucun JS ne s'exécute dans l'email.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
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
