import { useState } from "react";
import { Paperclip, Download, Eye, File, FileText, Image, FileSpreadsheet, Archive } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Attachment } from "@workspace/api-client-react";

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

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>("");
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

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
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = att.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.error("Attachment download error:", err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: "#8b9cb3" }}>
        <Paperclip size={13} />
        <span>{attachments.length} pièce{attachments.length > 1 ? "s" : ""} jointe{attachments.length > 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.content_type);
          const canPreview = isInlinePreviewable(att.content_type) || isPdf(att.content_type);
          const isLoading = downloading === att.id;

          return (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs group cursor-pointer transition-colors"
              style={{
                background: "#1a2332",
                border: "1px solid #1f2937",
                color: "#c9d1d9",
                maxWidth: 240,
              }}
              onClick={() => downloadAttachment(att, canPreview)}
            >
              <Icon size={16} style={{ color: "#2d7dd2", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{att.filename}</div>
                <div style={{ color: "#8b9cb3" }}>{formatSize(att.size)}</div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canPreview && (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadAttachment(att, true); }}
                    className="p-1 rounded hover:bg-white/10"
                    title="Aperçu"
                  >
                    <Eye size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); downloadAttachment(att, false); }}
                  className="p-1 rounded hover:bg-white/10"
                  title="Télécharger"
                  disabled={isLoading}
                >
                  <Download size={14} />
                </button>
              </div>
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
              <img src={previewUrl} alt="Aperçu" className="max-w-full max-h-[85vh] object-contain" />
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
  if (!count || count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: "#8b9cb3" }} title={`${count} pièce${count > 1 ? "s" : ""} jointe${count > 1 ? "s" : ""}`}>
      <Paperclip size={12} />
      <span>{count}</span>
    </span>
  );
}
