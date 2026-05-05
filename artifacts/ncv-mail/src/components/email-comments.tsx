import {
  useGetEmailComments,
  useUpdateEmailComment,
  useDeleteEmailComment,
  useGetOrganisationMembers,
  getGetEmailCommentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  MessageSquare,
  Send,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  User,
  AtSign,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs } from "date-fns/locale";
import type { Locale } from "date-fns";
import { useTranslation } from "react-i18next";

const dateFnsLocales: Record<string, Locale> = { fr, en: enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs };

interface OrgMember {
  id?: string;
  userId: string;
  fullName?: string | null;
  email?: string | null;
}

const baseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

interface ThreadEmailMeta {
  id?: number;
  sender?: string;
  subject?: string;
  body?: string;
  createdAt?: string;
}

export function EmailComments({
  emailId,
  currentUserId,
  email,
}: {
  emailId: number;
  currentUserId?: string;
  email?: ThreadEmailMeta;
}) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { data: comments, isLoading } = useGetEmailComments(emailId);
  const { data: members } = useGetOrganisationMembers();
  const updateComment = useUpdateEmailComment();
  const deleteComment = useDeleteEmailComment();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [adding, setAdding] = useState(false);

  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const langKey = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateLocale = dateFnsLocales[langKey] || fr;

  const orgMembers: OrgMember[] = (members as any[]) || [];

  const memberLookup = useMemo(() => {
    const m: Record<string, OrgMember> = {};
    orgMembers.forEach((mb) => { m[mb.userId] = mb; });
    return m;
  }, [orgMembers]);

  const filteredMembers = useMemo(() => {
    const q = suggestQuery.toLowerCase();
    return orgMembers
      .filter((mb) => mb.userId !== currentUserId)
      .filter((mb) => {
        if (!q) return true;
        return (mb.fullName || "").toLowerCase().includes(q) || (mb.email || "").toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [orgMembers, suggestQuery, currentUserId]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetEmailCommentsQueryKey(emailId) });
  }

  function onCommentChange(val: string) {
    setNewComment(val);
    const cursor = textareaRef.current?.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const m = before.match(/(?:^|\s)@([\p{L}0-9._-]*)$/u);
    if (m) {
      setSuggestQuery(m[1]);
      setShowSuggest(true);
    } else {
      setShowSuggest(false);
      setSuggestQuery("");
    }
  }

  function insertMention(member: OrgMember) {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = newComment.slice(0, cursor);
    const after = newComment.slice(cursor);
    const replaced = before.replace(/@([\p{L}0-9._-]*)$/u, `@${member.userId} `);
    const next = replaced + after;
    setNewComment(next);
    setMentionedIds((prev) => prev.includes(member.userId) ? prev : [...prev, member.userId]);
    setShowSuggest(false);
    setSuggestQuery("");
    setTimeout(() => {
      ta.focus();
      const pos = replaced.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  function renderBodyWithMentions(body: string, mentionMeta?: any[]) {
    const parts = body.split(/(@[0-9a-fA-F-]{36})/g);
    return parts.map((p, i) => {
      const m = p.match(/^@([0-9a-fA-F-]{36})$/);
      if (m) {
        const id = m[1];
        const meta = (mentionMeta || []).find((x) => x.userId === id);
        const name = meta?.name || memberLookup[id]?.fullName || memberLookup[id]?.email || "user";
        return <span key={i} className="text-primary bg-primary/10 rounded px-1">@{name}</span>;
      }
      return <span key={i}>{p}</span>;
    });
  }

  async function handleAdd() {
    if (!newComment.trim()) return;
    setAdding(true);
    try {
      const cited = Array.from(new Set(
        Array.from(newComment.matchAll(/@([0-9a-fA-F-]{36})/g)).map((m) => m[1])
      ));
      const res = await fetch(`${baseUrl()}/api/emails/${emailId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ body: newComment.trim(), mentions: cited.length ? cited : undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || t("common.error"));
      }
      setNewComment("");
      setMentionedIds([]);
      invalidate();
    } catch (e: any) {
      toast({ title: e?.message || t("common.error"), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(commentId: string) {
    if (!editingText.trim()) return;
    try {
      await updateComment.mutateAsync({ emailId, commentId, data: { body: editingText.trim() } });
      setEditingId(null);
      setEditingText("");
      invalidate();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment.mutateAsync({ emailId, commentId });
      invalidate();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  const commentList = (comments as any[]) || [];

  // ---------------------------------------------------------------
  // Realtime presence: who else is viewing this thread right now.
  // Uses Supabase Realtime channel "email-thread-<id>".
  // ---------------------------------------------------------------
  type Presence = { userId: string; name: string; color: string };
  const [presence, setPresence] = useState<Presence[]>([]);
  const [typingMap, setTypingMap] = useState<Record<string, { name: string; until: number }>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myNameRef = useRef<string>("");
  const lastTypingSentRef = useRef<number>(0);

  useEffect(() => {
    if (!currentUserId || !emailId) return;
    const me = orgMembers.find((m) => m.userId === currentUserId);
    const myName =
      me?.fullName || me?.email || (currentUserId ? currentUserId.slice(0, 6) : "user");
    myNameRef.current = myName;
    // deterministic color per user
    let h = 0;
    for (const c of currentUserId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const color = `hsl(${h % 360},65%,55%)`;

    const channel = supabase.channel(`email-thread-${emailId}`, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Presence[]>;
        const seen = new Map<string, Presence>();
        for (const arr of Object.values(state)) {
          for (const p of arr || []) {
            if (p?.userId) seen.set(p.userId, p);
          }
        }
        setPresence(Array.from(seen.values()));
      })
      .on("broadcast", { event: "typing" }, ({ payload }: any) => {
        const uid = payload?.userId;
        if (!uid || uid === currentUserId) return;
        setTypingMap((prev) => ({
          ...prev,
          [uid]: { name: payload.name || "…", until: Date.now() + 4000 },
        }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: currentUserId, name: myName, color } satisfies Presence);
        }
      });

    return () => {
      channelRef.current = null;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [emailId, currentUserId, orgMembers]);

  // GC stale typing entries
  useEffect(() => {
    const id = setInterval(() => {
      setTypingMap((prev) => {
        const now = Date.now();
        let changed = false;
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.until > now) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function broadcastTyping() {
    const ch = channelRef.current;
    if (!ch || !currentUserId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, name: myNameRef.current },
    }).catch(() => {});
  }

  const otherViewers = presence.filter((p) => p.userId !== currentUserId);
  const typingUsers = Object.entries(typingMap)
    .filter(([uid]) => uid !== currentUserId)
    .map(([, v]) => v.name);

  // ---------------------------------------------------------------
  // Unified thread timeline.
  // We mix the original email (when provided) with the internal
  // comments into a single chronologically-ordered list so the user
  // sees one continuous conversation timeline rather than a separate
  // "comments" panel hanging below the email.
  // ---------------------------------------------------------------
  type TimelineItem =
    | { kind: "email"; ts: number; data: ThreadEmailMeta }
    | { kind: "comment"; ts: number; data: any };

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    if (email && (email.sender || email.subject || email.body)) {
      const ts = email.createdAt ? new Date(email.createdAt).getTime() : 0;
      items.push({ kind: "email", ts, data: email });
    }
    for (const c of commentList) {
      const ts = c?.createdAt ? new Date(c.createdAt).getTime() : 0;
      items.push({ kind: "comment", ts, data: c });
    }
    items.sort((a, b) => a.ts - b.ts);
    return items;
  }, [email, commentList]);

  function plainSnippet(html: string | undefined): string {
    if (!html) return "";
    let s = String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (typeof document !== "undefined") {
      for (let i = 0; i < 5; i++) {
        const before = s;
        s = s.replace(/(&[a-z]+;|&#\d+;|&#x[0-9a-f]+;)/gi, (m) => {
          const el = document.createElement("span");
          el.innerHTML = m;
          return el.textContent || m;
        });
        if (s === before) break;
      }
    }
    return s;
  }

  return (
    <div className="border-t border-border">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
              {t("comments.threadTitle", { count: commentList.length, defaultValue: "Conversation" })}
            </span>
          </div>
          {typingUsers.length > 0 && (
            <span className="text-[10px] italic text-[#b8c5d6] mr-2">
              {typingUsers.length === 1
                ? t("comments.typingOne", { defaultValue: "{{name}} is typing…", name: typingUsers[0] })
                : t("comments.typingMany", { defaultValue: "Several people are typing…" })}
            </span>
          )}
          {otherViewers.length > 0 && (
            <div className="flex items-center -space-x-1.5" title={t("comments.viewing", { defaultValue: "Viewing now" })}>
              {otherViewers.slice(0, 5).map((p) => (
                <div
                  key={p.userId}
                  title={p.name}
                  className="w-5 h-5 rounded-full ring-2 ring-card flex items-center justify-center text-[9px] font-semibold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {(p.name || "?").charAt(0).toUpperCase()}
                </div>
              ))}
              {otherViewers.length > 5 && (
                <div className="w-5 h-5 rounded-full bg-[#374151] ring-2 ring-card flex items-center justify-center text-[9px] text-white">
                  +{otherViewers.length - 5}
                </div>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : timeline.length > 0 ? (
          <div className="relative space-y-2.5 mb-3 pl-4 border-l border-border/60">
            {timeline.map((item) => {
              if (item.kind === "email") {
                const e = item.data;
                const snippet = plainSnippet(e.body).slice(0, 280);
                return (
                  <div key={`email-${e.id ?? "self"}`} className="relative bg-card border border-primary/20 rounded-lg px-3 py-2.5">
                    <span className="absolute -left-[19px] top-3 w-3 h-3 rounded-full bg-primary/30 border-2 border-card" />
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <Mail className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-[11px] font-semibold text-white truncate">
                        {e.sender || t("comments.anonymous")}
                      </span>
                      {e.createdAt && (
                        <span className="text-[10px] text-[#b8c5d6]">
                          {format(new Date(e.createdAt), "d MMM yyyy HH:mm", { locale: dateLocale })}
                        </span>
                      )}
                      <span className="text-[9px] text-primary/80 uppercase tracking-wider ml-auto">
                        {t("comments.emailMessage", { defaultValue: "Email" })}
                      </span>
                    </div>
                    {e.subject && e.subject !== email?.subject && (
                      <p className="text-[11px] text-white/80 mb-1 line-clamp-1">{e.subject}</p>
                    )}
                    {snippet && (
                      <p className="text-[12px] text-[#c9d1d9] leading-relaxed line-clamp-3">
                        {snippet}
                      </p>
                    )}
                  </div>
                );
              }
              const comment = item.data;
              const isOwn = comment.userId === currentUserId;
              const isEditing = editingId === comment.id;
              return (
                <div key={`c-${comment.id}`} className="relative bg-background rounded-lg px-3 py-2.5">
                  <span className="absolute -left-[19px] top-3 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-[11px] font-medium text-white">
                        {comment.authorName || t("comments.anonymous")}
                      </span>
                      <span className="text-[10px] text-[#b8c5d6]">
                        {format(new Date(comment.createdAt), "d MMM yyyy HH:mm", { locale: dateLocale })}
                      </span>
                      {comment.updatedAt !== comment.createdAt && (
                        <span className="text-[9px] text-[#b8c5d6] italic">{t("comments.edited")}</span>
                      )}
                      <span className="text-[9px] text-primary/80 uppercase tracking-wider">
                        {t("comments.internalNote", { defaultValue: "Note" })}
                      </span>
                    </div>
                    {isOwn && !isEditing && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingId(comment.id); setEditingText(comment.body); }} className="text-[#b8c5d6] hover:text-white p-0.5">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(comment.id)} className="text-[#b8c5d6] hover:text-red-400 p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="h-16 bg-card border-border text-white text-[12px] resize-none" autoFocus />
                      <div className="flex items-center gap-1.5 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditingText(""); }} className="h-6 text-[10px] text-[#b8c5d6]">
                          <X className="w-3 h-3 mr-0.5" /> {t("comments.cancel")}
                        </Button>
                        <Button size="sm" onClick={() => handleUpdate(comment.id)} disabled={!editingText.trim() || updateComment.isPending} className="h-6 text-[10px]">
                          <Check className="w-3 h-3 mr-0.5" /> {t("comments.save")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#c9d1d9] leading-relaxed whitespace-pre-wrap">
                      {renderBodyWithMentions(comment.body, comment.mentions)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="relative">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => { onCommentChange(e.target.value); broadcastTyping(); }}
              placeholder={t("comments.placeholderMention")}
              className="h-14 bg-background border-border text-white text-[12px] resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setShowSuggest(false); return; }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button size="sm" className="h-14 px-3" disabled={!newComment.trim() || adding} onClick={handleAdd}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
          {showSuggest && filteredMembers.length > 0 && (
            <div className="absolute left-0 bottom-full mb-1 z-30 bg-card border border-border rounded shadow-lg w-64 max-h-56 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wider text-[#b8c5d6] px-2 pt-1.5 flex items-center gap-1">
                <AtSign className="w-3 h-3" /> {t("comments.mentionPick")}
              </div>
              {filteredMembers.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => insertMention(m)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-background"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-white truncate">{m.fullName || m.email}</div>
                    {m.fullName && m.email && <div className="text-[10px] text-[#b8c5d6] truncate">{m.email}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          <p className="text-[9px] text-[#b8c5d6] mt-1">
            {t("comments.ctrlEnter")} · {t("comments.mentionHint")}
            {mentionedIds.length > 0 && <span className="ml-2 text-primary">· {mentionedIds.length} @</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
