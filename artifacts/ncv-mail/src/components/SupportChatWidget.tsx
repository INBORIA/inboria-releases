import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircleQuestion, Send, X, Loader2, Bot, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function SupportChatWidget() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem("inboria-assistant-offset");
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.x === "number" && typeof p.y === "number") return p;
      }
    } catch {}
    return { x: 0, y: 0 };
  });
  const dragState = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const onButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onButtonPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (!dragState.current.moved && Math.hypot(dx, dy) < 5) return;
    dragState.current.moved = true;
    const nx = dragState.current.baseX + dx;
    const ny = dragState.current.baseY + dy;
    setOffset({
      x: Math.max(-(window.innerWidth - 80), Math.min(0, nx)),
      y: Math.max(-(window.innerHeight - 80), Math.min(0, ny)),
    });
  };
  const onButtonPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const wasDrag = dragState.current?.moved ?? false;
    if (wasDrag) {
      try { localStorage.setItem("inboria-assistant-offset", JSON.stringify(offset)); } catch {}
    } else {
      setIsOpen((v) => !v);
    }
    dragState.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const currentLang = i18n.resolvedLanguage || i18n.language?.substring(0, 2) || "fr";
  useEffect(() => {
    setMessages([]);
  }, [currentLang]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !session?.access_token) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/ai/support-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          language: i18n.resolvedLanguage || i18n.language?.substring(0, 2) || "fr",
          history: messages.slice(-6),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("supportChat.errorMessage"),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 z-[120] w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[calc(100vh-8rem)] bg-[#141c2b] border border-[#1f2937] rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[#1a2435] border-b border-[#1f2937]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">
                  {t("supportChat.title")}
                </p>
                <p className="text-[10px] text-[#b8c5d6]">
                  {t("supportChat.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#b8c5d6] hover:text-white transition-colors p-1 rounded-md hover:bg-white/[0.06]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <MessageCircleQuestion className="h-6 w-6 text-primary" />
                </div>
                <p className="text-[13px] font-medium text-white mb-1">
                  {t("supportChat.welcomeTitle")}
                </p>
                <p className="text-[11px] text-[#b8c5d6] leading-relaxed">
                  {t("supportChat.welcomeMessage")}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-[12px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-white/[0.06] text-[#c9d1d9] border border-[#1f2937] rounded-bl-sm"
                  }`}
                >
                  {msg.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < msg.content.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
                {msg.role === "user" && (
                  <div className="h-6 w-6 rounded-full bg-[#1e3a5f] flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-white/[0.06] border border-[#1f2937] px-3 py-2 rounded-lg rounded-bl-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-3 border-t border-[#1f2937] bg-[#1a2435]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("supportChat.placeholder")}
                disabled={isLoading}
                className="flex-1 bg-white/[0.06] border border-[#1f2937] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-[#b8c5d6] focus:outline-none focus:border-primary/50 disabled:opacity-50"
                maxLength={2000}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            <p className="text-[9px] text-[#b8c5d6] mt-1.5 text-center">
              {t("supportChat.poweredBy")}
            </p>
          </div>
        </div>
      )}

      <button
        onPointerDown={onButtonPointerDown}
        onPointerMove={onButtonPointerMove}
        onPointerUp={onButtonPointerUp}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, touchAction: "none" }}
        className={`fixed bottom-4 right-4 z-[121] h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-colors duration-200 cursor-grab active:cursor-grabbing ${
          isOpen
            ? "bg-[#1f2937] hover:bg-[#2a3545]"
            : "bg-primary hover:bg-primary/90"
        }`}
        title={t("supportChat.title") + " — Glisser pour déplacer"}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <MessageCircleQuestion className="h-5 w-5 text-white" />
        )}
      </button>
    </>
  );
}
