import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UploadedFile } from "@/components/FileAttachInput";
import { useAttachmentUpload } from "@/hooks/use-attachment-upload";
import { useToast } from "@/hooks/use-toast";
import { hasNativeIosScanner, scanNativeDocument } from "@/lib/native-ios";

export function NativeDocumentScanner({
  files,
  onChange,
}: {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { addFiles } = useAttachmentUpload();
  const [scanning, setScanning] = useState(false);

  if (!hasNativeIosScanner()) return null;

  const scan = async () => {
    setScanning(true);
    try {
      const file = await scanNativeDocument();
      if (!file) return;
      const next = await addFiles([file], files);
      if (next) onChange(next);
    } catch {
      toast({
        title: t("attachments.scanFailed", "Le document n’a pas pu être scanné"),
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void scan()}
      disabled={scanning || files.length >= 25}
      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors bg-transparent border border-[#1f2937] text-[#b8c5d6]"
      data-testid="button-native-document-scanner"
    >
      {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
      {t("attachments.scan", "Scanner")}
    </button>
  );
}