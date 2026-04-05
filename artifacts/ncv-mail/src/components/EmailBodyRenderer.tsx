import { useRef, useEffect, useState } from "react";

function isHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

export function EmailBodyRenderer({ body }: { body?: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(200);

  const content = body || "";
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
