import { useCallback, useEffect, useRef } from "react";
import { authFetch } from "@/lib/api-fetch";

// Glisser-dehors d'un mail depuis une ligne de liste vers le bureau / un
// dossier (fichier .eml, Chromium uniquement). Même contrainte que pour les
// pièces jointes : `dataTransfer` n'est modifiable QUE pendant l'événement
// `dragstart` (synchrone). On pré-télécharge donc le .eml dès le survol /
// l'appui pour que l'URL soit prête au démarrage du glisser.
//
// Renvoie des props à étaler sur l'élément « poignée » (l'avatar de la ligne),
// pour ne pas entrer en conflit avec la sélection au lasso de la ligne entière.
export function useRowDragOut(emailId: number, subject?: string | null) {
  const blobUrl = useRef<string | null>(null);
  const fetching = useRef(false);

  const safeName =
    (subject || "mail").replace(/[^a-zA-Z0-9._\- ]+/g, "_").slice(0, 60).trim() || "mail";
  const filename = `${safeName}-${emailId}.eml`;

  useEffect(() => {
    return () => {
      if (blobUrl.current) {
        URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = null;
      }
    };
  }, []);

  const prefetch = useCallback(() => {
    if (blobUrl.current || fetching.current) return;
    fetching.current = true;
    void (async () => {
      try {
        const res = await authFetch(`api/emails/${emailId}/export.eml`);
        if (res.ok) blobUrl.current = URL.createObjectURL(await res.blob());
      } catch {
        /* noop */
      } finally {
        fetching.current = false;
      }
    })();
  }, [emailId]);

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      const ready = blobUrl.current;
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
    [filename, prefetch],
  );

  return {
    draggable: true,
    onDragStart,
    onMouseEnter: prefetch,
    onPointerDown: prefetch,
  } as const;
}
