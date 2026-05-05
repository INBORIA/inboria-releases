import { useRef, useState } from "react";
import { Paperclip, X, File, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";

export interface UploadedFile {
  uploadId: string;
  filename: string;
  contentType: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface Props {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
}

export function FileAttachInput({ files, onChange, maxFiles = 10, maxSizeMb = 10 }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;

    const remaining = maxFiles - files.length;
    if (remaining <= 0) {
      setError(t("attachments.maxFiles", { count: maxFiles }));
      return;
    }

    const toUpload = Array.from(selected).slice(0, remaining);
    const oversized = toUpload.filter((f) => f.size > maxSizeMb * 1024 * 1024);
    if (oversized.length > 0) {
      setError(t("attachments.fileTooLarge", { size: maxSizeMb }));
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("attachments.notAuthenticated")); return; }

      const formData = new FormData();
      for (const f of toUpload) {
        formData.append("files", f);
      }

      const response = await fetch(`${import.meta.env.BASE_URL}api/attachments/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setError((err as any).error || t("attachments.uploadError"));
        return;
      }

      const result = await response.json();
      const uploaded: UploadedFile[] = (result.files || []).map((f: any) => ({
        uploadId: f.uploadId,
        filename: f.filename,
        contentType: f.contentType,
        size: f.size,
      }));

      onChange([...files, ...uploaded]);
    } catch (err: any) {
      setError(err.message || t("attachments.uploadError"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeFile(index: number) {
    const updated = [...files];
    updated.splice(index, 1);
    onChange(updated);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || files.length >= maxFiles}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors"
        style={{
          color: uploading ? "#555" : "#b8c5d6",
          background: "transparent",
          border: "1px solid #1f2937",
        }}
        title={t("attachments.attachFile")}
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        <span>{t("attachments.attachFile")}</span>
      </button>

      {error && (
        <p className="text-xs mt-1" style={{ color: "#e74c3c" }}>{error}</p>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {files.map((f, i) => (
            <div
              key={f.uploadId}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs"
              style={{ background: "#1a2332", border: "1px solid #1f2937", color: "#c9d1d9" }}
            >
              <File size={12} style={{ color: "#2d7dd2" }} />
              <span className="truncate max-w-[150px]">{f.filename}</span>
              <span style={{ color: "#b8c5d6" }}>{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-0.5 p-0.5 rounded hover:bg-white/10"
                title={t("attachments.remove")}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
