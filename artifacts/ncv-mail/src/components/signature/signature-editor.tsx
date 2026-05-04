import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Link as LinkIcon, Image as ImageIcon, Eraser, Highlighter, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TEXT_COLOR_SWATCHES: string[] = [
  "#000000", "#1f2937", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db", "#ffffff",
  "#7f1d1d", "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#16a34a",
  "#0d9488", "#0891b2", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#9333ea",
  "#c026d3", "#db2777", "#e11d48", "#f59e0b", "#84cc16", "#10b981", "#06b6d4",
];

const HIGHLIGHT_SWATCHES: string[] = [
  "transparent", "#FFFF00", "#00FF00", "#00FFFF", "#FF00FF", "#FF0000", "#0070C0", "#000000",
  "#FFE699", "#C6E0B4", "#BDD7EE", "#F4B084", "#F8CBAD", "#D9E1F2", "#E2EFDA", "#FFF2CC",
  "#FFC000", "#92D050", "#00B050", "#00B0F0", "#7030A0", "#C00000", "#002060", "#A6A6A6",
];

const FONT_FAMILIES: Array<{ label: string; stack: string }> = [
  { label: "Aptos", stack: "Aptos, 'Segoe UI', Arial, sans-serif" },
  { label: "Arial", stack: "Arial, sans-serif" },
  { label: "Arial Black", stack: "'Arial Black', Gadget, sans-serif" },
  { label: "Calibri", stack: "Calibri, 'Segoe UI', Arial, sans-serif" },
  { label: "Calibri Light", stack: "'Calibri Light', Calibri, 'Segoe UI', Arial, sans-serif" },
  { label: "Cambria", stack: "Cambria, Georgia, serif" },
  { label: "Candara", stack: "Candara, 'Segoe UI', Arial, sans-serif" },
  { label: "Comic Sans MS", stack: "'Comic Sans MS', 'Comic Sans', cursive" },
  { label: "Consolas", stack: "Consolas, 'Courier New', monospace" },
  { label: "Constantia", stack: "Constantia, Georgia, serif" },
  { label: "Corbel", stack: "Corbel, 'Segoe UI', Arial, sans-serif" },
  { label: "Courier New", stack: "'Courier New', Courier, monospace" },
  { label: "Franklin Gothic", stack: "'Franklin Gothic', 'Franklin Gothic Medium', Arial, sans-serif" },
  { label: "Garamond", stack: "Garamond, Georgia, serif" },
  { label: "Georgia", stack: "Georgia, serif" },
  { label: "Helvetica", stack: "Helvetica, Arial, sans-serif" },
  { label: "Impact", stack: "Impact, Charcoal, sans-serif" },
  { label: "Lucida Console", stack: "'Lucida Console', Monaco, monospace" },
  { label: "Lucida Sans Unicode", stack: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif" },
  { label: "Palatino Linotype", stack: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
  { label: "Segoe UI", stack: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  { label: "Tahoma", stack: "Tahoma, Geneva, sans-serif" },
  { label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  { label: "Trebuchet MS", stack: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
];

const FONT_SIZES_PX = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

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
  const colorInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [lastTextColor, setLastTextColor] = useState<string>("#dc2626");
  const [lastHighlight, setLastHighlight] = useState<string>("#fde68a");
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (initialisedRef.current && document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
    initialisedRef.current = true;
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const r = savedRangeRef.current;
    if (!r || !editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(r);
  };

  const exec = (command: string, val?: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
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
      restoreSelection();
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, img);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    reader.readAsDataURL(file);
  };

  // Wrap the current selection in a <span style="..."> with the given inline
  // CSS. If the selection is collapsed, insert an empty span so future typed
  // text picks up the style (mimics Outlook behaviour for size/color/font).
  const wrapSelectionWithStyle = (cssProperty: string, cssValue: string) => {
    restoreSelection();
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    if (range.collapsed) {
      const span = document.createElement("span");
      span.setAttribute("style", `${cssProperty}: ${cssValue};`);
      span.appendChild(document.createTextNode("\u200B"));
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span.firstChild!, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      // Wrap the extracted contents in a styled span. extractContents handles
      // partial-node selections (e.g. selection that crosses element boundaries)
      // by cloning ancestors as needed, which is the deterministic behaviour
      // we want here. We then re-insert the styled span at the original range.
      const fragment = range.extractContents();
      const span = document.createElement("span");
      span.setAttribute("style", `${cssProperty}: ${cssValue};`);
      span.appendChild(fragment);
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const applyFontFamily = (stack: string) => wrapSelectionWithStyle("font-family", stack);
  const applyFontSize = (px: number) => wrapSelectionWithStyle("font-size", `${px}px`);
  const applyColor = (color: string) => {
    setLastTextColor(color);
    exec("foreColor", color);
  };
  const applyHighlight = (color: string) => {
    setLastHighlight(color);
    // 'hiliteColor' is the modern command name; some browsers (Firefox) use it,
    // others (Chrome, Edge) accept it as well. Fallback to 'backColor' if needed.
    const value = color === "transparent" ? "transparent" : color;
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    if (!document.execCommand("hiliteColor", false, value)) {
      document.execCommand("backColor", false, value);
    }
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-1 flex-wrap rounded-md border border-border bg-card px-2 py-1.5"
        onMouseDown={(e) => {
          // Preserve the editor selection when interacting with the toolbar.
          if (e.target !== editorRef.current) saveSelection();
        }}
      >
        <Select onValueChange={(v) => applyFontFamily(v)}>
          <SelectTrigger
            onMouseDown={() => saveSelection()}
            className="h-7 w-[140px] text-[11px] bg-background border-border text-white"
            title={t("signature.font", "Police")}
          >
            <SelectValue placeholder={t("signature.font", "Police")} />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f.label} value={f.stack} style={{ fontFamily: f.stack }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => applyFontSize(Number(v))}>
          <SelectTrigger
            onMouseDown={() => saveSelection()}
            className="h-7 w-[80px] text-[11px] bg-background border-border text-white"
            title={t("signature.size", "Taille")}
          >
            <SelectValue placeholder={t("signature.size", "Taille")} />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {FONT_SIZES_PX.map((px) => (
              <SelectItem key={px} value={String(px)}>
                {px}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="w-px h-4 bg-border mx-0.5" />
        <ToolbarBtn label={t("signature.bold", "Gras")} onMouseDown={saveSelection} onClick={() => exec("bold")}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn label={t("signature.italic", "Italique")} onMouseDown={saveSelection} onClick={() => exec("italic")}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn label={t("signature.underline", "Souligné")} onMouseDown={saveSelection} onClick={() => exec("underline")}><Underline className="w-3.5 h-3.5" /></ToolbarBtn>

        <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={t("signature.color", "Couleur du texte")}
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
              className="h-7 w-7 p-0 flex flex-col items-center justify-center gap-0 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
            >
              <Type className="w-3 h-3" />
              <span className="block w-3.5 h-[3px] rounded-sm" style={{ backgroundColor: lastTextColor }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[228px] p-2" align="start" onOpenAutoFocus={(e) => e.preventDefault()} onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => { const t = e.target as HTMLElement; if (t && t.closest('input[type="color"]')) e.preventDefault(); }}>
            <ColorGrid swatches={TEXT_COLOR_SWATCHES} onPick={(c) => { applyColor(c); setTextColorOpen(false); }} />
            <div
              className="mt-2 relative w-full h-7 rounded border border-border hover:border-primary/60"
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
            >
              <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none text-[11px] text-[#8b9cb3]">
                <span
                  className="inline-block w-3 h-3 rounded-sm border border-white/20"
                  style={{ backgroundColor: lastTextColor }}
                />
                {t("signature.moreColors", "Plus de couleurs…")}
              </div>
              <input
                ref={colorInputRef}
                type="color"
                value={lastTextColor}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
                onChange={(e) => { applyColor(e.target.value); setTextColorOpen(false); }}
              />
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={t("signature.highlight", "Surlignage")}
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
              className="h-7 w-7 p-0 flex flex-col items-center justify-center gap-0 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
            >
              <Highlighter className="w-3 h-3" />
              <span className="block w-3.5 h-[3px] rounded-sm border border-white/10" style={{ backgroundColor: lastHighlight === "transparent" ? "#ffffff" : lastHighlight }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-2" align="start" onOpenAutoFocus={(e) => e.preventDefault()} onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => { const t = e.target as HTMLElement; if (t && t.closest('input[type="color"]')) e.preventDefault(); }}>
            <div className="text-[10px] uppercase tracking-wider text-[#8b9cb3] mb-1">Surlignage</div>
            <ColorGrid swatches={HIGHLIGHT_SWATCHES} onPick={(c) => { applyHighlight(c); setHighlightOpen(false); }} showNoneLabel cols={8} />
            <div
              className="mt-2 relative w-full h-7 rounded border border-border hover:border-primary/60"
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
            >
              <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none text-[11px] text-[#8b9cb3]">
                <span
                  className="inline-block w-3 h-3 rounded-sm border border-white/20"
                  style={{ backgroundColor: lastHighlight === "transparent" ? "#1a2236" : lastHighlight }}
                />
                {t("signature.moreColors", "Plus de couleurs…")}
              </div>
              <input
                ref={highlightInputRef}
                type="color"
                value={lastHighlight === "transparent" ? "#ffff00" : lastHighlight}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
                onChange={(e) => { applyHighlight(e.target.value); setHighlightOpen(false); }}
              />
            </div>
          </PopoverContent>
        </Popover>

        <span className="w-px h-4 bg-border mx-0.5" />
        <ToolbarBtn label={t("signature.link", "Lien")} onMouseDown={saveSelection} onClick={handleInsertLink}><LinkIcon className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn label={t("signature.image", "Image / logo")} onMouseDown={saveSelection} onClick={handleImageButton}><ImageIcon className="w-3.5 h-3.5" /></ToolbarBtn>
        <span className="w-px h-4 bg-border mx-0.5" />
        <ToolbarBtn label={t("signature.clear", "Effacer mise en forme")} onMouseDown={saveSelection} onClick={() => exec("removeFormat")}><Eraser className="w-3.5 h-3.5" /></ToolbarBtn>
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
        onBlur={() => { setIsFocused(false); saveSelection(); }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        data-placeholder={placeholder || ""}
        className={`signature-editor min-h-[140px] rounded-md border bg-card px-3 py-2 text-[12px] text-white outline-none ${isFocused ? "border-primary/50" : "border-border"}`}
      />
      <p className="text-[10px] text-[#8b9cb3]">
        {t("signature.imageHint", "Astuce : insérez un logo PNG/JPG (max 200 Ko). L'image est intégrée directement dans la signature.")}
      </p>
    </div>
  );
}

function ColorGrid({
  swatches,
  onPick,
  showNoneLabel,
  cols = 7,
}: {
  swatches: string[];
  onPick: (color: string) => void;
  showNoneLabel?: boolean;
  cols?: number;
}) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {swatches.map((c, idx) => {
        const isNone = c === "transparent";
        return (
          <button
            key={`${c}-${idx}`}
            type="button"
            title={isNone ? (showNoneLabel ? "Aucun" : c) : c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
            className="h-7 w-7 rounded border border-white/15 hover:ring-2 hover:ring-primary/70 hover:scale-110 transition-transform shadow-sm"
            style={{
              backgroundColor: isNone ? "#1a2236" : c,
              backgroundImage: isNone
                ? "linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)"
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  onMouseDown,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onMouseDown?: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        if (onMouseDown) onMouseDown();
      }}
      onClick={onClick}
      className="h-7 w-7 p-0 text-[#8b9cb3] hover:text-white hover:bg-white/[0.06]"
    >
      {children}
    </Button>
  );
}
