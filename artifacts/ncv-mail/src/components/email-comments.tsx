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
  Users,
  AtSign,
  Mail,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import type { Locale } from "date-fns";
import { useTranslation } from "react-i18next";

const dateFnsLocales: Record<string, Locale> = { fr, en: enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el };

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

type SystemEventPayload =
  | { event: "assign"; actor: string; actorName: string; target: string; targetName: string; selfAssign?: boolean }
  | { event: "reassign"; actor: string; actorName: string; previous: string; previousName: string; target: string; targetName: string }
  | { event: "unassign"; actor: string; actorName: string; previous: string; previousName: string };

const SYS_PREFIX = "__SYS__:";

function parseSystemBody(body: string): SystemEventPayload | null {
  if (!body || !body.startsWith(SYS_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(SYS_PREFIX.length)) as SystemEventPayload;
  } catch {
    return null;
  }
}

export function EmailComments({
  emailId,
  currentUserId,
  email,
  assignedTo,
  sharedMailboxId,
  ownerId,
}: {
  emailId: number;
  currentUserId?: string;
  email?: ThreadEmailMeta;
  assignedTo?: string | null;
  sharedMailboxId?: string | null;
  ownerId?: string | null;
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
  const [collapsed, setCollapsed] = useState(true);
  // L'utilisateur a-t-il replié/déroulé le fil à la main ? Si oui, on ne
  // force plus l'ouverture automatique (on respecte son choix).
  const userToggledRef = useRef(false);

  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState("");
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [showRecipients, setShowRecipients] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recipientPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showRecipients) return;
    function onClickOutside(e: MouseEvent) {
      if (recipientPanelRef.current && !recipientPanelRef.current.contains(e.target as Node)) {
        setShowRecipients(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showRecipients]);

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
      const cited = Array.from(new Set([
        ...Array.from(newComment.matchAll(/@([0-9a-fA-F-]{36})/g)).map((m) => m[1]),
        ...Array.from(recipients),
      ]));
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
      setRecipients(new Set());
      setRecipientFilter("");
      invalidate();
      broadcastComment();
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
      broadcastComment();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment.mutateAsync({ emailId, commentId });
      invalidate();
      broadcastComment();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common.error"), variant: "destructive" });
    }
  }

  const commentList = (comments as any[]) || [];

  // Dérouler le fil automatiquement dès qu'il y a au moins un message —
  // sauf si l'utilisateur l'a explicitement replié/déroulé lui-même.
  useEffect(() => {
    if (!userToggledRef.current && commentList.length > 0) {
      setCollapsed(false);
    }
  }, [commentList.length]);

  // Visibilité conditionnelle du Chat équipe — règle STRICTE :
  // - boîte partagée → toujours visible (toute l'équipe peut participer)
  // - mail perso assigné à un coéquipier ≠ propriétaire → visible des
  //   DEUX côtés (assignant/propriétaire ET assigné)
  // - sinon (perso non assigné, ou propriétaire qui s'auto-assigne seul)
  //   → masqué (pas de second interlocuteur)
  // L'historique de commentaires (y compris bulles système) ne maintient
  // PAS le chat ouvert : à la désassignation d'un mail perso, il se ferme.
  const isShared = Boolean(sharedMailboxId);
  const isCollabAssignment =
    Boolean(assignedTo) && Boolean(ownerId) && assignedTo !== ownerId;
  const chatVisible = isShared || isCollabAssignment;

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
    // Point n°4 (montée en charge) : n'ouvrir le canal temps réel QUE si le chat
    // d'équipe est réellement visible (boîte partagée ou mail assigné en
    // collaboration). Pour un mail perso d'un utilisateur seul, il n'y a aucun
    // second interlocuteur : inutile de maintenir un canal présence/typing/comment
    // (économie majeure à grande échelle + réduit le thrash du verrou auth gotrue).
    if (!currentUserId || !emailId || !chatVisible) {
      setPresence([]);
      return;
    }
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
      .on("broadcast", { event: "comment" }, ({ payload }: any) => {
        // Un coéquipier a ajouté / modifié / supprimé un message dans ce fil.
        // On rafraîchit l'historique pour l'afficher en temps réel, sans
        // que l'utilisateur ait à recharger la page.
        if (payload?.by === currentUserId) return;
        queryClient.invalidateQueries({ queryKey: getGetEmailCommentsQueryKey(emailId) });
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
  }, [emailId, currentUserId, orgMembers, chatVisible]);

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

  // Prévenir en temps réel les autres personnes qui regardent ce mail qu'un
  // message vient d'être ajouté / modifié / supprimé, pour qu'elles
  // rafraîchissent leur fil sans recharger la page.
  function broadcastComment() {
    channelRef.current
      ?.send({ type: "broadcast", event: "comment", payload: { by: currentUserId } })
      .catch(() => {});
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
    for (const c of commentList) {
      const ts = c?.createdAt ? new Date(c.createdAt).getTime() : 0;
      items.push({ kind: "comment", ts, data: c });
    }
    items.sort((a, b) => a.ts - b.ts);
    return items;
  }, [commentList]);

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

  if (!chatVisible) return null;

  return (
    <div className="border-t border-border">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => { userToggledRef.current = true; setCollapsed((v) => !v); }}
            className="flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
            data-testid="button-toggle-comments"
          >
            {collapsed ? <ChevronRight className="w-3 h-3 text-[#b8c5d6]" /> : <ChevronDown className="w-3 h-3 text-[#b8c5d6]" />}
            <MessageSquare className="w-3.5 h-3.5 text-[#b8c5d6]" />
            <span className="text-[11px] font-medium text-[#b8c5d6] uppercase tracking-wider">
              {t("comments.threadTitle", { count: commentList.length, defaultValue: "Chat équipe" })}
            </span>
          </button>
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
                  className="w-5 h-5 rounded-full ring-2 ring-card flex items-center justify-center text-[9px] font-semibold text-[#fff]"
                  style={{ backgroundColor: p.color }}
                >
                  {(p.name || "?").charAt(0).toUpperCase()}
                </div>
              ))}
              {otherViewers.length > 5 && (
                <div className="w-5 h-5 rounded-full bg-[#374151] ring-2 ring-card flex items-center justify-center text-[9px] text-[#fff]">
                  +{otherViewers.length - 5}
                </div>
              )}
            </div>
          )}
        </div>

        {!collapsed && (<>
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
              const sys = parseSystemBody(comment.body);
              if (sys) {
                let label = "";
                if (sys.event === "assign") {
                  label = sys.selfAssign
                    ? t("comments.systemSelfAssigned", { defaultValue: "{{actor}} a pris ce mail en charge", actor: sys.actorName })
                    : t("comments.systemAssigned", { defaultValue: "{{actor}} a assigné ce mail à {{target}}", actor: sys.actorName, target: sys.targetName });
                } else if (sys.event === "reassign") {
                  label = t("comments.systemReassigned", {
                    defaultValue: "{{actor}} a réassigné de {{previous}} à {{target}}",
                    actor: sys.actorName,
                    previous: sys.previousName,
                    target: sys.targetName,
                  });
                } else if (sys.event === "unassign") {
                  label = t("comments.systemUnassigned", {
                    defaultValue: "{{actor}} a désassigné {{previous}}",
                    actor: sys.actorName,
                    previous: sys.previousName,
                  });
                }
                return (
                  <div key={`sys-${comment.id}`} className="relative flex items-center justify-center py-1">
                    <span className="absolute -left-[19px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#374151] border-2 border-card" />
                    <span
                      className="text-[10px] text-[#b8c5d6] italic px-2 py-0.5 rounded bg-white/[0.03] border border-border/50"
                      data-testid={`system-bubble-${sys.event}`}
                    >
                      {label}
                      {comment.createdAt && (
                        <span className="ml-1.5 text-[#7a8699] not-italic">
                          · {format(new Date(comment.createdAt), "d MMM HH:mm", { locale: dateLocale })}
                        </span>
                      )}
                    </span>
                  </div>
                );
              }
              const isOwn = comment.userId === currentUserId;
              const isEditing = editingId === comment.id;
              return (
                <div key={`c-${comment.id}`} className="relative bg-background rounded-lg px-3 py-2.5">
                  <span className="absolute -left-[19px] top-3 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-primary">
                          {(comment.authorName || "?").trim().charAt(0).toUpperCase()}
                        </span>
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
          {recipients.size > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {Array.from(recipients).map((uid) => {
                const m = memberLookup[uid];
                const label = m?.fullName || m?.email || uid.slice(0, 6);
                return (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-1 text-[10px] bg-primary/15 border border-primary/30 text-primary rounded px-1.5 py-0.5"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => setRecipients((prev) => { const n = new Set(prev); n.delete(uid); return n; })}
                      className="hover:text-white"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => { onCommentChange(e.target.value); broadcastTyping(); }}
              placeholder={t("comments.placeholderSimple", { defaultValue: "Entrez votre message…" })}
              className="h-14 bg-background border-border text-white text-[12px] resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setShowSuggest(false); return; }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-[26px] px-2 text-[10px] gap-1 relative"
                onClick={() => setShowRecipients((v) => !v)}
                data-testid="button-pick-recipients"
                title={t("comments.recipientsPick", { defaultValue: "Destinataires de la note" })}
              >
                <Users className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {t("comments.recipients", { defaultValue: "Destinataires" })}
                </span>
                {recipients.size > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-semibold bg-primary text-primary-foreground rounded-full px-1">
                    {recipients.size}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                className="h-[26px] px-2"
                disabled={!newComment.trim() || adding}
                onClick={handleAdd}
              >
                {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          {showRecipients && (
            <div
              ref={recipientPanelRef}
              className="absolute right-0 bottom-full mb-1 z-30 bg-card border border-border rounded-md shadow-lg w-72 max-h-72 flex flex-col"
            >
              <div className="flex items-center justify-between px-2.5 py-2 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-[#b8c5d6] flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {t("comments.recipientsPick", { defaultValue: "Destinataires de la note" })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecipients(false)}
                  className="text-[#b8c5d6] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="px-2 py-1.5 border-b border-border">
                <input
                  type="text"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  placeholder={t("comments.recipientsFilter", { defaultValue: "Rechercher un membre…" })}
                  className="w-full h-7 bg-background border border-border rounded px-2 text-[11px] text-white placeholder:text-[#7a8699] focus:outline-none focus:border-primary/50"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {(() => {
                  const q = recipientFilter.toLowerCase().trim();
                  const list = orgMembers
                    .filter((mb) => mb.userId !== currentUserId)
                    .filter((mb) => {
                      if (!q) return true;
                      return (mb.fullName || "").toLowerCase().includes(q) || (mb.email || "").toLowerCase().includes(q);
                    });
                  if (list.length === 0) {
                    return (
                      <div className="px-3 py-4 text-[11px] text-[#b8c5d6] text-center">
                        {t("comments.recipientsEmpty", { defaultValue: "Aucun membre" })}
                      </div>
                    );
                  }
                  return list.map((m) => {
                    const checked = recipients.has(m.userId);
                    return (
                      <label
                        key={m.userId}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-background cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setRecipients((prev) => {
                            const n = new Set(prev);
                            if (n.has(m.userId)) n.delete(m.userId); else n.add(m.userId);
                            return n;
                          })}
                          className="w-3.5 h-3.5 accent-primary cursor-pointer"
                        />
                        <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <span className="text-[9px] font-semibold text-primary">
                            {(m.fullName || m.email || "?").trim().charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-white truncate">{m.fullName || m.email}</div>
                          {m.fullName && m.email && <div className="text-[10px] text-[#b8c5d6] truncate">{m.email}</div>}
                        </div>
                      </label>
                    );
                  });
                })()}
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRecipients(new Set())}
                  disabled={recipients.size === 0}
                  className="text-[10px] text-[#b8c5d6] hover:text-white disabled:opacity-40"
                >
                  {t("comments.recipientsClear", { defaultValue: "Vider" })}
                </button>
                <span className="text-[10px] text-[#b8c5d6]">
                  {t("comments.recipientsSelected", { defaultValue: "{{count}} sélectionné(s)", count: recipients.size })}
                </span>
              </div>
            </div>
          )}
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
          {mentionedIds.length > 0 && (
            <p className="text-[9px] text-primary mt-1">
              · {mentionedIds.length} @
            </p>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}
