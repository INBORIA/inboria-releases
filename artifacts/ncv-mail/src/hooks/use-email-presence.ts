import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PresenceMode = "viewing" | "replying";

export interface EmailPeer {
  userId: string;
  name: string;
  color: string;
  state: PresenceMode;
}

function colorForUser(userId: string): string {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360},65%,55%)`;
}

/**
 * T004 — Présence temps réel par email pour la détection de collision de
 * réponse (boîtes partagées / mails assignés). Canal Supabase Realtime dédié
 * `email-reply-<id>` (distinct du canal commentaires `email-thread-<id>`).
 *
 * Chaque membre track `{ userId, name, color, state }` où `state` vaut
 * "replying" tant que `replying` est vrai (composer de réponse ouvert).
 * `peers` exclut l'utilisateur courant. Activer uniquement en contexte partagé
 * via `enabled`.
 *
 * `replying` est géré en interne : à chaque (ré)abonnement (y compris au
 * changement d'email pendant que le composer reste ouvert) on re-track l'état
 * courant, et tout changement de `replying` est propagé si déjà abonné.
 */
export function useEmailPresence(opts: {
  emailId?: number | null;
  currentUserId?: string | null;
  name?: string | null;
  enabled?: boolean;
  replying?: boolean;
}) {
  const { emailId, currentUserId, name, enabled = true, replying = false } = opts;
  const [peers, setPeers] = useState<EmailPeer[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const replyingRef = useRef(replying);
  const infoRef = useRef<{ name: string; color: string }>({ name: "", color: "" });

  replyingRef.current = replying;

  const trackState = (userId: string) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.track({
      userId,
      name: infoRef.current.name,
      color: infoRef.current.color,
      state: replyingRef.current ? "replying" : "viewing",
    } satisfies EmailPeer).catch(() => {});
  };

  useEffect(() => {
    if (!enabled || !emailId || !currentUserId) {
      setPeers([]);
      return;
    }
    const color = colorForUser(currentUserId);
    const myName = name || currentUserId.slice(0, 6);
    infoRef.current = { name: myName, color };
    subscribedRef.current = false;

    const channel = supabase.channel(`email-reply-${emailId}`, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, EmailPeer[]>;
        const seen = new Map<string, EmailPeer>();
        for (const arr of Object.values(state)) {
          for (const p of arr || []) {
            if (p?.userId && p.userId !== currentUserId) seen.set(p.userId, p);
          }
        }
        setPeers(Array.from(seen.values()));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          subscribedRef.current = true;
          trackState(currentUserId);
        }
      });

    return () => {
      channelRef.current = null;
      subscribedRef.current = false;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId, currentUserId, name, enabled]);

  // Propage un changement de `replying` quand le canal est déjà abonné.
  useEffect(() => {
    if (subscribedRef.current && currentUserId) trackState(currentUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replying, currentUserId]);

  return { peers };
}
