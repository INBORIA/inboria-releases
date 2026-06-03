import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authJson } from "@/lib/api-fetch";

export interface DraftFields {
  to: string;
  cc: string;
  subject: string;
  body: string;
}

export interface DraftEditor {
  userId: string;
  name: string;
  color: string;
}

interface DraftDto extends DraftFields {
  id: string;
  updatedBy: string;
  updatedAt: string;
}

// Couleur déterministe par utilisateur (même logique que la presence des commentaires).
function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash * 31) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

interface UseSharedDraftOptions {
  emailId?: number | null;
  sharedMailboxId?: string | null;
  currentUserId?: string | null;
  name?: string | null;
  // Appelé quand le contenu distant (autre éditeur) doit être appliqué au composer.
  onRemote: (fields: DraftFields, by: string) => void;
}

/**
 * Brouillon partagé / co-rédaction temps réel.
 * - activate(seed) : crée (ou rejoint) le brouillon partagé du mail courant.
 * - sync(fields)   : pousse les modifications locales (broadcast quasi temps réel + persistance debounced).
 * - editors        : autres membres en train d'éditer (presence).
 * - remove()       : supprime le brouillon (appelé à l'envoi).
 * v1 : dernier qui écrit gagne (pas d'OT/CRDT).
 */
export function useSharedDraft({
  emailId,
  sharedMailboxId,
  currentUserId,
  name,
  onRemote,
}: UseSharedDraftOptions) {
  const [active, setActive] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [editors, setEditors] = useState<DraftEditor[]>([]);
  const [lastEditor, setLastEditor] = useState<{ name: string; at: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSyncedRef = useRef<string>("");
  const bcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const myInfoRef = useRef<{ name: string; color: string }>({ name: "", color: "" });

  // Réinitialise tout quand on change de mail.
  useEffect(() => {
    setActive(false);
    setDraftId(null);
    setEditors([]);
    setLastEditor(null);
    lastSyncedRef.current = "";
  }, [emailId]);

  const activate = useCallback(
    async (seed: DraftFields) => {
      if (!currentUserId) return;
      try {
        let draft: DraftDto | null = null;
        if (emailId != null) {
          const list = await authJson<DraftDto[]>(`api/drafts?emailId=${emailId}`);
          if (list && list.length > 0) draft = list[0]!;
        }
        if (!draft) {
          draft = await authJson<DraftDto>("api/drafts", {
            method: "POST",
            body: JSON.stringify({
              emailId: emailId ?? null,
              sharedMailboxId: sharedMailboxId ?? null,
              to: seed.to,
              cc: seed.cc,
              subject: seed.subject,
              body: seed.body,
            }),
          });
        } else {
          // On rejoint un brouillon existant : on adopte son contenu.
          const fields: DraftFields = {
            to: draft.to,
            cc: draft.cc,
            subject: draft.subject,
            body: draft.body,
          };
          lastSyncedRef.current = JSON.stringify(fields);
          onRemoteRef.current(fields, "load");
        }
        if (lastSyncedRef.current === "") {
          lastSyncedRef.current = JSON.stringify(seed);
        }
        setDraftId(draft.id);
        setActive(true);
      } catch {
        // silencieux : l'appelant gère l'absence d'effet (table non migrée, etc.)
      }
    },
    [currentUserId, emailId, sharedMailboxId],
  );

  const deactivate = useCallback(() => {
    setActive(false);
    setDraftId(null);
    setEditors([]);
    setLastEditor(null);
    lastSyncedRef.current = "";
  }, []);

  const remove = useCallback(async () => {
    const id = draftId;
    deactivate();
    if (id) {
      try {
        await authJson(`api/drafts/${id}`, { method: "DELETE" });
      } catch {
        /* noop */
      }
    }
  }, [draftId, deactivate]);

  // Canal realtime : presence des éditeurs + broadcast des modifications.
  useEffect(() => {
    if (!active || !draftId || !currentUserId) return;
    const color = colorForUser(currentUserId);
    const myName = name || currentUserId.slice(0, 6);
    myInfoRef.current = { name: myName, color };

    const channel = supabase.channel(`draft-${draftId}`, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, DraftEditor[]>;
        const seen = new Map<string, DraftEditor>();
        for (const arr of Object.values(state)) {
          for (const p of arr || []) {
            if (p?.userId && p.userId !== currentUserId) seen.set(p.userId, p);
          }
        }
        setEditors(Array.from(seen.values()));
      })
      .on("broadcast", { event: "patch" }, ({ payload }: { payload?: Record<string, unknown> }) => {
        if (!payload || payload.by === currentUserId) return;
        const fields: DraftFields = {
          to: String(payload.to ?? ""),
          cc: String(payload.cc ?? ""),
          subject: String(payload.subject ?? ""),
          body: String(payload.body ?? ""),
        };
        lastSyncedRef.current = JSON.stringify(fields);
        setLastEditor({ name: String(payload.name ?? "…"), at: Date.now() });
        onRemoteRef.current(fields, String(payload.by ?? ""));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: currentUserId, name: myName, color });
        }
      });

    return () => {
      channelRef.current = null;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [active, draftId, currentUserId, name]);

  const sync = useCallback(
    (fields: DraftFields) => {
      if (!active || !draftId) return;
      const json = JSON.stringify(fields);
      if (json === lastSyncedRef.current) return; // écho d'une modif distante, ou rien de neuf
      lastSyncedRef.current = json;

      if (bcDebounceRef.current) clearTimeout(bcDebounceRef.current);
      bcDebounceRef.current = setTimeout(() => {
        channelRef.current
          ?.send({
            type: "broadcast",
            event: "patch",
            payload: { by: currentUserId, name: myInfoRef.current.name, ...fields },
          })
          .catch(() => {});
      }, 250);

      setSaving(true);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        try {
          await authJson(`api/drafts/${draftId}`, {
            method: "PATCH",
            body: JSON.stringify(fields),
          });
        } catch {
          /* noop */
        }
        setSaving(false);
      }, 900);
    },
    [active, draftId, currentUserId],
  );

  // Nettoyage des timers au démontage.
  useEffect(() => {
    return () => {
      if (bcDebounceRef.current) clearTimeout(bcDebounceRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  return { active, draftId, editors, lastEditor, saving, activate, deactivate, sync, remove };
}
