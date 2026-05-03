import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Loader2, Bot, User as UserIcon, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Parse "[mail#1234]" markers in assistant replies and render them as
// inline clickable chips that open the email in the dashboard.
function renderAssistantContent(
  text: string,
  onOpenMail: (id: number) => void,
): React.ReactNode {
  const re = /\[mail#(\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const id = Number(m[1]);
    parts.push(
      <button
        key={`mail-${key++}-${id}`}
        type="button"
        onClick={() => onOpenMail(id)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-medium transition-colors align-baseline"
        data-testid={`inboria-chat-mail-link-${id}`}
        title={`Ouvrir le mail #${id}`}
      >
        <Mail className="h-3 w-3" />
        Ouvrir
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

export function InboriaChatButton() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const openMail = useCallback(
    (id: number) => {
      // Inboria chat → ouverture directe du mail dans le tableau de bord.
      // 1) Si on est déjà sur /dashboard, un événement custom indique au
      //    dashboard d'ouvrir l'email (plus fiable que d'écouter les
      //    changements de query string avec wouter v3).
      // 2) Sinon, on navigue vers /dashboard?emailId=X et l'init du
      //    state via URL fait le travail.
      try {
        window.dispatchEvent(
          new CustomEvent("inboria-open-mail", { detail: { id } }),
        );
      } catch {}
      setLocation(`/dashboard?emailId=${id}`);
      setIsOpen(false);
    },
    [setLocation],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !session?.access_token) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const body: Record<string, unknown> = {
        messages: nextMessages.slice(-20),
      };
      const res = await fetch(`${baseUrl}/api/inboria/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "request failed");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "" }]);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    } catch (err: any) {
      const isQuota = err?.message && /quota|crédit|credit/i.test(String(err.message));
      const errorMsg = isQuota ? t("inboriaChat.errorQuota") : t("inboriaChat.errorGeneric");
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      toast({ title: errorMsg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => setMessages([]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 gap-1.5 px-2.5 hover:bg-purple-500/10 text-zinc-200"
          aria-label={t("inboriaChat.openLabel")}
          data-testid="inboria-chat-button"
        >
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium">
            Inbor<span className="text-cyan-400">ia</span>
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 bg-zinc-950 border-zinc-800"
      >
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold text-zinc-100 leading-tight">
                Inbor<span className="text-cyan-400">ia</span>
              </SheetTitle>
              <p className="text-xs text-zinc-500 leading-tight">{t("inboriaChat.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 pr-7">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearConversation}
                className="text-xs text-zinc-400 hover:text-zinc-100 h-7"
              >
                {t("inboriaChat.clear")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm font-medium text-zinc-200">
                {t("inboriaChat.greetingTitle")}
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                {t("inboriaChat.greetingDesc")}
              </p>
              <div className="mt-5 w-full space-y-2">
                {[
                  t("inboriaChat.suggest1"),
                  t("inboriaChat.suggest2"),
                  t("inboriaChat.suggest3"),
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-purple-600 text-white rounded-br-sm"
                    : "bg-zinc-800 text-zinc-100 rounded-bl-sm",
                )}
              >
                {m.role === "assistant"
                  ? renderAssistantContent(m.content, openMail)
                  : m.content}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-zinc-200" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-zinc-800 text-zinc-300 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("inboriaChat.thinking")}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("inboriaChat.inputPlaceholder")}
              rows={2}
              className="resize-none bg-zinc-900 border-zinc-800 text-sm min-h-[60px] max-h-[160px]"
              disabled={isLoading}
              data-testid="inboria-chat-input"
            />
            <Button
              type="button"
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 h-9 w-9 shrink-0"
              data-testid="inboria-chat-send"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5 text-center">
            {t("inboriaChat.footerHint")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
