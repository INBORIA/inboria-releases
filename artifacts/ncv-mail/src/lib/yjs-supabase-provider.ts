import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { toBase64, fromBase64 } from "lib0/buffer";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Provider Yjs (CRDT) sur le canal de diffusion Supabase Realtime.
 *
 * Réutilise l'infrastructure temps réel déjà en place (aucun serveur
 * WebSocket dédié à déployer) pour faire transiter :
 *  - les mises à jour du document Yjs (deltas binaires, encodés base64) ;
 *  - l'« awareness » (curseurs / sélections en direct des autres éditeurs).
 *
 * Poignée de synchro à l'arrivée d'un nouveau pair : il diffuse `sync-request`,
 * les pairs déjà présents répondent avec l'état complet du document + leur
 * awareness. Ainsi un éditeur qui rejoint récupère immédiatement le contenu
 * fusionné sans serveur central.
 */
export class SupabaseYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  synced = false;

  private channel: RealtimeChannel;
  private destroyed = false;

  constructor(roomName: string, doc: Y.Doc) {
    this.doc = doc;
    this.awareness = new Awareness(doc);

    this.channel = supabase.channel(`yjs:${roomName}`, {
      config: { broadcast: { self: false } },
    });

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);

    this.channel
      .on("broadcast", { event: "doc" }, ({ payload }) => {
        const u = (payload as { u?: string } | undefined)?.u;
        if (!u) return;
        Y.applyUpdate(this.doc, fromBase64(u), this);
      })
      .on("broadcast", { event: "awareness" }, ({ payload }) => {
        const u = (payload as { u?: string } | undefined)?.u;
        if (!u) return;
        applyAwarenessUpdate(this.awareness, fromBase64(u), this);
      })
      .on("broadcast", { event: "sync-request" }, () => {
        // Un pair vient d'arriver : on lui envoie l'état complet du doc + notre awareness.
        const update = Y.encodeStateAsUpdate(this.doc);
        void this.channel.send({
          type: "broadcast",
          event: "doc",
          payload: { u: toBase64(update) },
        });
        const states = Array.from(this.awareness.getStates().keys());
        if (states.length > 0) {
          const au = encodeAwarenessUpdate(this.awareness, states);
          void this.channel.send({
            type: "broadcast",
            event: "awareness",
            payload: { u: toBase64(au) },
          });
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.synced = true;
          void this.channel.send({
            type: "broadcast",
            event: "sync-request",
            payload: {},
          });
        }
      });
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Ne pas réémettre une mise à jour qu'on vient d'appliquer depuis un pair.
    if (origin === this) return;
    void this.channel.send({
      type: "broadcast",
      event: "doc",
      payload: { u: toBase64(update) },
    });
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === this) return;
    const changed = added.concat(updated, removed);
    const au = encodeAwarenessUpdate(this.awareness, changed);
    void this.channel.send({
      type: "broadcast",
      event: "awareness",
      payload: { u: toBase64(au) },
    });
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    removeAwarenessStates(this.awareness, [this.doc.clientID], "provider-destroy");
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.awareness.destroy();
    void supabase.removeChannel(this.channel);
  }
}
