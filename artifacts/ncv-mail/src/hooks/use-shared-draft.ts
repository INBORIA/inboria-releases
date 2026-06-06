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
  createdBy?: string | null;
  updatedBy: string;
  updatedAt: string;
  sendClaimedBy?: string | null;
  sendClaimedAt?: string | null;
}

// Couleur déterministe par utilisateur, renvoyée en HEXADÉCIMAL (#rrggbb).
// Important : y-prosemirror colore la sélection distante via `${color}70` (alpha hex) ;
// un `hsl(...)` produirait `hsl(...)70` invalide → sélections invisibles. D'où le hex.
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash * 31) % 360;
  return hslToHex(hue, 70, 60);
}

// Convertit une couleur HSL en #rrggbb.
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface UseSharedDraftOptions {
  emailId?: number | null;
  sharedMailboxId?: string | null;
  currentUserId?: string | null;
  name?: string | null;
  // Quand true, le corps du message est co-édité via Yjs (CRDT) côté composer :
  // le hook NE synchronise alors plus le champ `body` (ni broadcast ni PATCH),
  // il ne gère que destinataire / sujet + présence + verrou d'envoi.
  bodyCollaborative?: boolean;
  // Appelé quand le contenu distant (autre éditeur) doit être appliqué au composer.
  onRemote: (fields: DraftFields, by: string) => void;
  // Appelé quand un autre membre a envoyé le mail (le composer doit se fermer).
  onClosedByOther?: (name: string) => void;
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
  bodyCollaborative,
  onRemote,
  onClosedByOther,
}: UseSharedDraftOptions) {
  const [active, setActive] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [editors, setEditors] = useState<DraftEditor[]>([]);
  // Passe à true dès le premier événement de présence reçu : on sait alors de
  // façon fiable si on est seul (editors.length===0) ou non. Sert à n'autoriser
  // l'amorçage du contenu qu'à bon escient (anti-doublon, cf. CollaborativeComposer).
  const [presenceSynced, setPresenceSynced] = useState(false);
  const [lastEditor, setLastEditor] = useState<{ name: string; at: number } | null>(null);
  const [saving, setSaving] = useState(false);
  // T005 — revendication d'envoi : id du membre qui « prend l'envoi » (null = personne).
  const [sendClaimedBy, setSendClaimedBy] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSyncedRef = useRef<string>("");
  const bcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const onClosedByOtherRef = useRef(onClosedByOther);
  onClosedByOtherRef.current = onClosedByOther;
  const myInfoRef = useRef<{ name: string; color: string }>({ name: "", color: "" });

  // Réinitialise tout quand on change de mail.
  useEffect(() => {
    setActive(false);
    setDraftId(null);
    setCreatedBy(null);
    setEditors([]);
    setLastEditor(null);
    setSendClaimedBy(null);
    setPresenceSynced(false);
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
        setSendClaimedBy(draft.sendClaimedBy ?? null);
        setCreatedBy(draft.createdBy ?? currentUserId ?? null);
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
    setCreatedBy(null);
    setEditors([]);
    setLastEditor(null);
    setSendClaimedBy(null);
    setPresenceSynced(false);
    lastSyncedRef.current = "";
  }, []);

  // Supprime un brouillon par son id EXPLICITE (capturé au clic d'envoi), pour que
  // le nettoyage post-envoi (différé de ~10s via l'anti-envoi) reste fiable même si
  // l'état du hook a changé entre-temps (composer fermé, brouillon désactivé, etc.).
  const removeById = useCallback(
    async (id: string | null) => {
      // Prévient les autres éditeurs que le mail vient d'être envoyé (fermeture
      // automatique de leur composer -> anti double-envoi). Best-effort : si le
      // canal a déjà été démonté, la suppression DB ci-dessous reste garantie.
      channelRef.current
        ?.send({
          type: "broadcast",
          event: "sent",
          payload: { by: currentUserId, name: myInfoRef.current.name },
        })
        .catch(() => {});
      deactivate();
      if (id) {
        try {
          await authJson(`api/drafts/${id}`, { method: "DELETE" });
        } catch {
          /* noop */
        }
      }
    },
    [deactivate, currentUserId],
  );

  const remove = useCallback(async () => {
    await removeById(draftId);
  }, [draftId, removeById]);

  // T005 — « C'est moi qui envoie » : revendique l'envoi (verrouille les autres).
  const claimSend = useCallback(async () => {
    if (!draftId || !currentUserId) return;
    setSendClaimedBy(currentUserId);
    channelRef.current
      ?.send({ type: "broadcast", event: "claim", payload: { by: currentUserId, claimedBy: currentUserId } })
      .catch(() => {});
    try {
      await authJson(`api/drafts/${draftId}`, {
        method: "PATCH",
        body: JSON.stringify({ sendClaimedBy: currentUserId }),
      });
    } catch {
      /* noop */
    }
  }, [draftId, currentUserId]);

  // « Libérer » : rend la main pour que quelqu'un d'autre puisse envoyer.
  const releaseSend = useCallback(async () => {
    if (!draftId) return;
    setSendClaimedBy(null);
    channelRef.current
      ?.send({ type: "broadcast", event: "claim", payload: { by: currentUserId, claimedBy: null } })
      .catch(() => {});
    try {
      await authJson(`api/drafts/${draftId}`, {
        method: "PATCH",
        body: JSON.stringify({ sendClaimedBy: null }),
      });
    } catch {
      /* noop */
    }
  }, [draftId, currentUserId]);

  // Canal realtime : presence des éditeurs + broadcast des modifications.
  useEffect(() => {
    if (!active || !draftId || !currentUserId) return;
    setPresenceSynced(false);
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
        setPresenceSynced(true);
      })
      .on("broadcast", { event: "patch" }, ({ payload }: { payload?: Record<string, unknown> }) => {
        if (!payload || payload.by === currentUserId) return;
        const fields: DraftFields = {
          to: String(payload.to ?? ""),
          cc: String(payload.cc ?? ""),
          subject: String(payload.subject ?? ""),
          body: String(payload.body ?? ""),
        };
        // L'anti-écho doit comparer la MÊME forme que celle émise par sync() :
        // en mode co-édition le corps est exclu, sinon on garde le payload complet.
        lastSyncedRef.current = JSON.stringify(
          bodyCollaborative ? { to: fields.to, cc: fields.cc, subject: fields.subject } : fields,
        );
        setLastEditor({ name: String(payload.name ?? "…"), at: Date.now() });
        onRemoteRef.current(fields, String(payload.by ?? ""));
      })
      .on("broadcast", { event: "claim" }, ({ payload }: { payload?: Record<string, unknown> }) => {
        if (!payload) return;
        setSendClaimedBy((payload.claimedBy as string | null) ?? null);
      })
      .on("broadcast", { event: "sent" }, ({ payload }: { payload?: Record<string, unknown> }) => {
        if (!payload || payload.by === currentUserId) return;
        onClosedByOtherRef.current?.(String(payload.name ?? "…"));
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
      // En mode co-édition, le corps est géré par Yjs : on ne synchronise ici
      // que destinataire / sujet (le champ body est exclu du broadcast ET du PATCH).
      const payload: Partial<DraftFields> = bodyCollaborative
        ? { to: fields.to, cc: fields.cc, subject: fields.subject }
        : fields;
      const json = JSON.stringify(payload);
      if (json === lastSyncedRef.current) return; // écho d'une modif distante, ou rien de neuf
      lastSyncedRef.current = json;

      if (bcDebounceRef.current) clearTimeout(bcDebounceRef.current);
      bcDebounceRef.current = setTimeout(() => {
        channelRef.current
          ?.send({
            type: "broadcast",
            event: "patch",
            payload: { by: currentUserId, name: myInfoRef.current.name, ...payload },
          })
          .catch(() => {});
      }, 250);

      setSaving(true);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        try {
          await authJson(`api/drafts/${draftId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        } catch {
          /* noop */
        }
        setSaving(false);
      }, 900);
    },
    [active, draftId, currentUserId, bodyCollaborative],
  );

  // Nettoyage des timers au démontage.
  useEffect(() => {
    return () => {
      if (bcDebounceRef.current) clearTimeout(bcDebounceRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  return {
    active,
    draftId,
    createdBy,
    editors,
    presenceSynced,
    lastEditor,
    saving,
    sendClaimedBy,
    activate,
    deactivate,
    sync,
    remove,
    removeById,
    claimSend,
    releaseSend,
  };
}
