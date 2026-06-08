import { useCallback } from "react";
import { authFetch } from "@/lib/api-fetch";

// Glisser-dehors d'un mail depuis une ligne de liste vers le bureau / un
// dossier (fichier .eml, Chromium uniquement). Même contrainte que pour les
// pièces jointes : `dataTransfer` n'est modifiable QUE pendant l'événement
// `dragstart` (synchrone). On pré-télécharge donc le .eml dès le survol /
// l'appui pour que l'URL soit prête au démarrage du glisser.
//
// Renvoie des props à étaler sur l'élément « poignée » (l'avatar de la ligne),
// pour ne pas entrer en conflit avec la sélection au lasso de la ligne entière.
//
// Le blob est mémorisé dans un cache partagé (toutes les lignes / toutes les
// pages) avec éviction LRU. Effet : une fois un mail pré-téléchargé (au survol
// de son avatar, ou parce qu'on l'a déjà glissé ailleurs), le glisser suivant
// est instantané — ce qui réduit fortement l'échec silencieux du tout premier
// glisser (le blob n'a souvent pas le temps d'arriver entre l'appui et le
// dragstart).

const blobCache = new Map<string, string>();
const inFlight = new Set<string>();
const CACHE_MAX = 60;

// Vrai LRU : Map conserve l'ordre d'insertion, donc « toucher » une clé
// (delete + re-set) la replace en position la plus récente.
function touch(key: string): string | undefined {
  const url = blobCache.get(key);
  if (url !== undefined) {
    blobCache.delete(key);
    blobCache.set(key, url);
  }
  return url;
}

function rememberBlob(key: string, url: string) {
  // Si la clé existait déjà (fetchs concurrents inter-composants), on révoque
  // l'ancienne ObjectURL pour éviter une fuite.
  const prev = blobCache.get(key);
  if (prev && prev !== url) URL.revokeObjectURL(prev);
  blobCache.delete(key);
  blobCache.set(key, url);
  if (blobCache.size > CACHE_MAX) {
    const oldest = blobCache.keys().next().value as string | undefined;
    if (oldest !== undefined) {
      const old = blobCache.get(oldest);
      if (old) URL.revokeObjectURL(old);
      blobCache.delete(oldest);
    }
  }
}

export function useRowDragOut(emailId: number, subject?: string | null) {
  const key = String(emailId);

  const safeName =
    (subject || "mail").replace(/[^a-zA-Z0-9._\- ]+/g, "_").slice(0, 60).trim() || "mail";
  const filename = `${safeName}-${emailId}.eml`;

  const prefetch = useCallback(() => {
    if (blobCache.has(key)) {
      touch(key);
      return;
    }
    if (inFlight.has(key)) return; // déduplication des fetchs en vol (toutes vues)
    inFlight.add(key);
    void (async () => {
      try {
        const res = await authFetch(`api/emails/${emailId}/export.eml`);
        if (res.ok) rememberBlob(key, URL.createObjectURL(await res.blob()));
      } catch {
        /* noop */
      } finally {
        inFlight.delete(key);
      }
    })();
  }, [emailId, key]);

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      const ready = touch(key);
      if (!ready) {
        // Pas encore prêt : on amorce la pré-fetch pour le prochain essai et on
        // laisse tomber ce glisser (clic pour ouvrir le mail reste dispo).
        prefetch();
        e.preventDefault();
        return;
      }
      // On empêche la ligne parente de démarrer une sélection au lasso.
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "copy";
      try {
        e.dataTransfer.setData("DownloadURL", `message/rfc822:${filename}:${ready}`);
      } catch {
        /* noop */
      }
    },
    [key, filename, prefetch],
  );

  return {
    draggable: true,
    onDragStart,
    onMouseEnter: prefetch,
    onPointerDown: prefetch,
  } as const;
}
