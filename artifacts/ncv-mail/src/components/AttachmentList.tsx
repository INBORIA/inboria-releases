import { useState, useRef, useEffect } from "react";
import { Paperclip, Download, Eye, File, FileText, Image, FileSpreadsheet, Archive } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Attachment } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return Image;
  if (contentType === "application/pdf") return FileText;
  if (contentType.includes("spreadsheet") || contentType.includes("excel") || contentType.includes("csv")) return FileSpreadsheet;
  if (contentType.includes("zip") || contentType.includes("rar") || contentType.includes("tar") || contentType.includes("gz")) return Archive;
  return File;
}

function isInlinePreviewable(contentType: string): boolean {
  return contentType.startsWith("image/");
}

function isPdf(contentType: string): boolean {
  return contentType === "application/pdf";
}

export function AttachmentList({ attachments, disableDownload }: { attachments: Attachment[]; disableDownload?: boolean }) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>("");
  const [downloading, setDownloading] = useState<string | null>(null);
  // Cache des blob-URLs pré-téléchargées pour le glisser-dehors. La spec HTML5
  // n'autorise l'écriture de dataTransfer QUE pendant dragstart (synchrone) :
  // impossible de poser l'URL après un fetch async. On pré-télécharge donc le
  // fichier dès le survol / l'appui pour que l'URL soit prête au dragstart.
  const blobUrls = useRef<Map<string, string>>(new Map());
  const fetching = useRef<Set<string>>(new Set());

  useEffect(() => {
    const cache = blobUrls.current;
    return () => {
      for (const u of cache.values()) URL.revokeObjectURL(u);
      cache.clear();
    };
  }, []);

  function prefetchForDrag(att: Attachment) {
    if (disableDownload) return;
    if (blobUrls.current.has(att.id) || fetching.current.has(att.id)) return;
    fetching.current.add(att.id);
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const url = `${import.meta.env.BASE_URL}api/attachments/${att.id}/download`;
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return;
        const blob = await res.blob();
        blobUrls.current.set(att.id, URL.createObjectURL(blob));
      } catch {
        /* noop */
      } finally {
        fetching.current.delete(att.id);
      }
    })();
  }

  // Drag-out HTML5 vers le bureau / un dossier (Chromium uniquement).
  function onAttachmentDragStart(e: React.DragEvent, att: Attachment) {
    const ready = blobUrls.current.get(att.id);
    if (!ready) {
      // Pas encore prêt : on lance le pré-téléchargement pour le prochain essai
      // et on laisse tomber ce glisser (le clic-pour-télécharger reste dispo).
      prefetchForDrag(att);
      e.preventDefault();
      return;
    }
    const ct = att.content_type || "application/octet-stream";
    e.dataTransfer.effectAllowed = "copy";
    try {
      e.dataTransfer.setData("DownloadURL", `${ct}:${att.filename}:${ready}`);
    } catch {
      /* noop */
    }
  }

  async function downloadAttachment(att: Attachment, preview = false) {
    setDownloading(att.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const url = `${import.meta.env.BASE_URL}api/attachments/${att.id}/download`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();

      if (preview && isPdf(att.content_type)) {
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank");
      } else if (preview && isInlinePreviewable(att.content_type)) {
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setPreviewType(att.content_type);
      } else {
        const { saveBlobAs } = await import("@/lib/export-utils");
        await saveBlobAs(blob, att.filename);
      }
    } catch (err) {
      console.error("Attachment download error:", err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: "#b8c5d6" }}>
        <Paperclip size={13} />
        <span>{t("attachments.count", { count: attachments.length })}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.content_type);
          const canPreview = isInlinePreviewable(att.content_type) || isPdf(att.content_type);
          const isLoading = downloading === att.id;

          return (
            <div
              key={att.id}
              draggable={!disableDownload}
              onDragStart={disableDownload ? undefined : (e) => onAttachmentDragStart(e, att)}
              onMouseEnter={disableDownload ? undefined : () => prefetchForDrag(att)}
              onPointerDown={disableDownload ? undefined : () => prefetchForDrag(att)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs group transition-colors"
              style={{
                background: "#1a2332",
                border: "1px solid #1f2937",
                color: "#c9d1d9",
                maxWidth: 240,
                cursor: disableDownload ? "default" : "pointer",
              }}
              title={disableDownload ? undefined : t("attachments.dragOutHint", "Cliquez pour télécharger, ou glissez vers le bureau")}
              onClick={disableDownload ? undefined : () => downloadAttachment(att, canPreview)}
            >
              <Icon size={16} style={{ color: "#2d7dd2", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{att.filename}</div>
                <div style={{ color: "#b8c5d6" }}>{formatSize(att.size)}</div>
              </div>
              {!disableDownload && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canPreview && (
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadAttachment(att, true); }}
                      className="p-1 rounded hover:bg-white/10"
                      title={t("attachments.preview")}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadAttachment(att, false); }}
                    className="p-1 rounded hover:bg-white/10"
                    title={t("attachments.download")}
                    disabled={isLoading}
                  >
                    <Download size={14} />
                  </button>
                </div>
              )}
              {isLoading && (
                <div className="animate-spin rounded-full h-3 w-3 border border-t-transparent" style={{ borderColor: "#2d7dd2", borderTopColor: "transparent" }} />
              )}
            </div>
          );
        })}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
        >
          <div className="max-w-4xl max-h-[90vh] overflow-auto rounded-lg" onClick={(e) => e.stopPropagation()}>
            {previewType.startsWith("image/") ? (
              <img src={previewUrl} alt={t("attachments.preview")} className="max-w-full max-h-[85vh] object-contain" />
            ) : null}
          </div>
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:opacity-80"
            onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function AttachmentBadge({ count }: { count: number }) {
  const { t } = useTranslation();
  if (!count || count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium hidden sm:inline-flex"
      style={{ background: "rgba(184,197,214,0.12)", color: "#b8c5d6", border: "1px solid rgba(184,197,214,0.15)" }}
      title={t("attachments.count", { count })}
    >
      <Paperclip size={10} />
      <span>{count}</span>
    </span>
  );
}
