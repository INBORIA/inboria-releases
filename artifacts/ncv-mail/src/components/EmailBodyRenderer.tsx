import { useRef, useEffect, useState, useMemo } from "react";

function isHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function isMimeContent(text: string): boolean {
  return /^------=_Part_|Content-Type:\s*text\//m.test(text) ||
    /Content-Transfer-Encoding:\s*(quoted-printable|base64)/i.test(text);
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function extractFromMime(raw: string): string {
  const parts: { type: string; content: string }[] = [];

  const boundaryMatch = raw.match(/boundary="?([^\s"]+)"?/i) ||
    raw.match(/^(------=_Part_[^\s]+)/m);
  
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const sections = raw.split(boundary);
    
    for (const section of sections) {
      const headerEnd = section.indexOf("\r\n\r\n") !== -1
        ? section.indexOf("\r\n\r\n")
        : section.indexOf("\n\n");
      
      if (headerEnd === -1) continue;
      
      const headers = section.slice(0, headerEnd);
      let body = section.slice(headerEnd + (section.indexOf("\r\n\r\n") !== -1 ? 4 : 2));
      
      body = body.replace(/^--\s*$/, "").trim();
      if (!body) continue;
      
      const typeMatch = headers.match(/Content-Type:\s*([^\s;]+)/i);
      const encodingMatch = headers.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      const type = typeMatch ? typeMatch[1].toLowerCase() : "text/plain";
      const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : "";
      
      if (encoding === "quoted-printable") {
        body = decodeQuotedPrintable(body);
      } else if (encoding === "base64") {
        try {
          body = atob(body.replace(/\s/g, ""));
        } catch {}
      }
      
      if (type === "text/html" || type === "text/plain") {
        parts.push({ type, content: body });
      }
    }
  } else {
    const encodingMatch = raw.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    const headerEnd = raw.indexOf("\r\n\r\n") !== -1
      ? raw.indexOf("\r\n\r\n") + 4
      : raw.indexOf("\n\n") !== -1
        ? raw.indexOf("\n\n") + 2
        : 0;
    
    let body = raw.slice(headerEnd).trim();
    const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : "";
    
    if (encoding === "quoted-printable") {
      body = decodeQuotedPrintable(body);
    }
    
    return body;
  }

  const htmlPart = parts.find(p => p.type === "text/html");
  if (htmlPart) return htmlPart.content;

  const textPart = parts.find(p => p.type === "text/plain");
  if (textPart) return textPart.content;

  return raw;
}

function cleanContent(raw: string): string {
  if (!raw) return "";
  if (isMimeContent(raw)) {
    return extractFromMime(raw);
  }
  return raw;
}

export function EmailBodyRenderer({ body }: { body?: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(200);

  const content = useMemo(() => cleanContent(body || ""), [body]);
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
