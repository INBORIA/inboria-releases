import React from "react";
import { Mail, User, ArrowRight, Paperclip } from "lucide-react";

export type AutocompleteItem =
  | { type: "sender"; key: string; sender: string; senderEmail: string }
  | { type: "email"; key: string; id: number; sender: string; subject: string; hasAttachment?: boolean }
  | { type: "operator"; key: string; label: string; insert: string };

interface Props {
  items: AutocompleteItem[];
  activeIndex: number;
  onHoverIndex: (i: number) => void;
  onSelect: (item: AutocompleteItem) => void;
  labels: {
    senders: string;
    emails: string;
    operators: string;
  };
}

export function SearchAutocomplete({ items, activeIndex, onHoverIndex, onSelect, labels }: Props) {
  if (items.length === 0) return null;
  const senders = items.filter((i) => i.type === "sender");
  const emails = items.filter((i) => i.type === "email");
  const operators = items.filter((i) => i.type === "operator");

  let runningIdx = -1;
  const renderItem = (item: AutocompleteItem) => {
    runningIdx += 1;
    const idx = runningIdx;
    const active = idx === activeIndex;
    const base = `w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors ${active ? "bg-primary/15 text-white" : "text-[#b8c5d6] hover:bg-white/[0.03]"}`;
    if (item.type === "sender") {
      return (
        <button
          key={item.key}
          type="button"
          onMouseEnter={() => onHoverIndex(idx)}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          className={base}
        >
          <User className="w-3 h-3 shrink-0 text-[#7aa5ff]" />
          <span className="truncate flex-1">{item.sender}</span>
          <span className="text-[10px] text-[#5a6270] font-mono">de:</span>
        </button>
      );
    }
    if (item.type === "email") {
      return (
        <button
          key={item.key}
          type="button"
          onMouseEnter={() => onHoverIndex(idx)}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          className={base}
        >
          <Mail className="w-3 h-3 shrink-0 text-[#8b95a7]" />
          <span className="truncate text-[#7a8290] w-32 shrink-0">{item.sender}</span>
          <span className="truncate flex-1">{item.subject || "(sans sujet)"}</span>
          {item.hasAttachment && <Paperclip className="w-3 h-3 text-[#5a6270] shrink-0" />}
          <ArrowRight className="w-3 h-3 text-[#5a6270] shrink-0" />
        </button>
      );
    }
    return (
      <button
        key={item.key}
        type="button"
        onMouseEnter={() => onHoverIndex(idx)}
        onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
        className={base}
      >
        <span className="text-[10px] font-mono text-[#7aa5ff] shrink-0">{item.insert}</span>
        <span className="truncate flex-1 text-[#8b95a7]">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border border-[#1f2630] bg-[#0d1218] shadow-2xl overflow-hidden">
      {senders.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#5a6270] bg-[#0a0f15]">{labels.senders}</div>
          {senders.map(renderItem)}
        </div>
      )}
      {emails.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#5a6270] bg-[#0a0f15]">{labels.emails}</div>
          {emails.map(renderItem)}
        </div>
      )}
      {operators.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#5a6270] bg-[#0a0f15]">{labels.operators}</div>
          {operators.map(renderItem)}
        </div>
      )}
    </div>
  );
}
