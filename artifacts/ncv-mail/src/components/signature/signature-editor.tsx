import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Link as LinkIcon, Image as ImageIcon, Eraser, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const FONT_SIZES = [
  { label: "10", value: "1" },
  { label: "12", value: "2" },
  { label: "14", value: "3" },
  { label: "16", value: "4" },
  { label: "18", value: "5" },
  { label: "24", value: "6" },
  { label: "32", value: "7" },
];

const MAX_IMAGE_BYTES = 200 * 1024;

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export function SignatureEditor({ value, onChange, placeholder }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (initialisedRef.current && document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
    initialisedRef.current = true;
  }, [value]);

  const exec = (command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleInsertLink = () => {
    const url = window.prompt(t("signature.linkUrlPrompt", "URL du lien (https://...)"));
    if (!url) return;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    exec("createLink", safe);
  };

  const handleImageButton = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: t("signature.imageInvalid", "Fichier image invalide") });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ variant: "destructive", title: t("signature.imageTooLarge", "Image trop lourde (max 200 Ko)") });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;
      const img = `<img src="${dataUrl}" alt="logo" style="max-height:80px;max-width:240px;display:inline-block;" />`;
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, img);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap rounded-md border border-border bg-card px-2 py-1.5">
        <ToolbarBtn label={t("signature.bold", "Gras")} onClick={() => exec("bold")}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn label={t("signature.italic", "Italique")} onClick={() => exec("italic")}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn label={t("signature.underline", "Souligné")} onClick={() => exec("underline")}><Underline className="w-3.5 h-3.5" /></ToolbarBtn>
        <span className="w-px h-4 bg-border mx-0.5" />
        <ToolbarBtn label={t("signature.link", "Lien")} onClick={handleInsertLink}><LinkIcon className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn label={t("signature.image", "Image / logo")} onClick={handleImageButton}><ImageIcon className="w-3.5 h-3.5" /></ToolbarBtn>
        <span className="w-px h-4 bg-border mx-0.5" />
        <ToolbarBtn label={t("signature.smallText", "Petit texte")} onClick={() => exec("fontSize", "2")}><Type className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn label={t("signature.clear", "Effacer mise en forme")} onClick={() => exec("removeFormat")}><Eraser className="w-3.5 h-3.5" /></ToolbarBtn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        data-placeholder={placeholder || ""}
        className={`signature-editor min-h-[140px] rounded-md border bg-card px-3 py-2 text-[12px] text-white outline-none ${isFocused ? "border-primary/50" : "border-border"}`}
      />
      <p className="text-[10px] text-[#8b9cb3]">
        {t("signature.imageHint", "Astuce : insérez un logo PNG/JPG (max 200 Ko). L'image est intégrée directement dans la signature.")}
      </p>
    </div>
  );
}

function ToolbarBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={label}
      onMouseDown={(e) => { e.preventDefault(); }}
      onClick={onClick}
      className="h-7 w-7 p-0 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
    >
      {children}
    </Button>
  );
}
