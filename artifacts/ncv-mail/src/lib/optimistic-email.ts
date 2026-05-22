import type { QueryClient } from "@tanstack/react-query";

// Task #308 — helpers Optimistic UI mutualisés pour toutes les pages mail
// (Envoyés, Reportés, Programmés, Dossiers, Archives, Indésirables,
// Corbeille, Tâches…).
//
// Pattern uniforme : on patche TOUTES les caches `listEmails(*)` du
// QueryClient (sans connaître les params précis : status, folderId,
// page…) via `setQueriesData` + predicate. Chaque appel renvoie une
// fonction `rollback()` à appeler dans onError pour restaurer l'état
// avant mutation.
//
// La Réception (`pages/dashboard/index.tsx`) garde son propre pattern
// `accumulatedEmails` (snapshot du state local) — déjà optimiste depuis
// longtemps, on ne le touche pas.
//
// Shape attendue côté caches (généré par orval depuis l'OpenAPI) :
//   PaginatedEmails              { emails: Email[],            total, page, totalPages }
//   PaginatedSharedMailboxEmails { emails: SharedMailboxEmail[], total, page, totalPages }
// Les deux exposent `.emails` (objets avec `id: number`), c'est notre
// seul point d'accroche commun.

type AnyEmailLike = { id?: number | string };
type AnyPaginatedLike = { emails?: AnyEmailLike[] } | undefined;

// Predicate qui matche TOUTES les variantes de la queryKey listEmails.
// orval encode la 1ʳᵉ entrée de la queryKey comme l'URL du endpoint :
// `/api/emails`. Les params (status, folderId, page, search…) sont
// dans les entrées suivantes — peu importe leur contenu, on patche tout.
function isListEmailsQuery(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  return typeof head === "string" && (head === "/api/emails" || head.startsWith("/api/emails?"));
}

// Capture un snapshot exhaustif de toutes les caches `listEmails(*)`
// AVANT mutation, pour pouvoir restaurer si le serveur refuse.
function captureSnapshots(
  queryClient: QueryClient,
): Array<[readonly unknown[], unknown]> {
  return queryClient
    .getQueryCache()
    .findAll({ predicate: (q) => isListEmailsQuery(q.queryKey) })
    .map((q) => [q.queryKey, q.state.data] as [readonly unknown[], unknown]);
}

function restoreSnapshots(
  queryClient: QueryClient,
  snapshots: Array<[readonly unknown[], unknown]>,
): void {
  snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

// Empêche un rollback de s'exécuter deux fois (sécurité si onError est
// déclenché plusieurs fois ou si l'appelant oublie qu'il a déjà rollback).
function once(fn: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}

// Annule (fire-and-forget) les fetches `listEmails` en vol pour éviter
// qu'une réponse réseau pré-mutation n'écrase notre patch optimiste.
function cancelInflightListEmails(queryClient: QueryClient): void {
  void queryClient.cancelQueries({
    predicate: (q) => isListEmailsQuery(q.queryKey),
  });
}

// Retire un email de toutes les listes en cache. Décrémente aussi
// `total` (best-effort) pour que les compteurs « X mails » affichés
// dans les bandeaux restent cohérents le temps de la requête serveur.
// Retourne un rollback à appeler dans onError.
export function removeEmailOptimistic(
  queryClient: QueryClient,
  id: number | string,
): () => void {
  cancelInflightListEmails(queryClient);
  const snapshots = captureSnapshots(queryClient);
  queryClient.setQueriesData<AnyPaginatedLike>(
    { predicate: (q) => isListEmailsQuery(q.queryKey) },
    (old) => {
      if (!old || !Array.isArray((old as any).emails)) return old;
      const emails = (old as any).emails as AnyEmailLike[];
      const filtered = emails.filter((e) => String(e?.id) !== String(id));
      if (filtered.length === emails.length) return old;
      const removed = emails.length - filtered.length;
      const total = typeof (old as any).total === "number"
        ? Math.max(0, (old as any).total - removed)
        : (old as any).total;
      return { ...(old as any), emails: filtered, total };
    },
  );
  return once(() => restoreSnapshots(queryClient, snapshots));
}

// Patch partiel d'un email dans toutes les listes (toggle read/unread,
// changement de catégorie, priorité, assignation, snoozeUntil…).
// Retourne un rollback à appeler dans onError.
export function patchEmailOptimistic(
  queryClient: QueryClient,
  id: number | string,
  patch: Record<string, unknown>,
): () => void {
  cancelInflightListEmails(queryClient);
  const snapshots = captureSnapshots(queryClient);
  queryClient.setQueriesData<AnyPaginatedLike>(
    { predicate: (q) => isListEmailsQuery(q.queryKey) },
    (old) => {
      if (!old || !Array.isArray((old as any).emails)) return old;
      const emails = (old as any).emails as AnyEmailLike[];
      let changed = false;
      const next = emails.map((e) => {
        if (String(e?.id) === String(id)) {
          changed = true;
          return { ...e, ...patch };
        }
        return e;
      });
      if (!changed) return old;
      return { ...(old as any), emails: next };
    },
  );
  return once(() => restoreSnapshots(queryClient, snapshots));
}

// Suppression de plusieurs emails d'un coup (bulk archive / delete /
// restore depuis la sélection multiple).
export function removeEmailsOptimistic(
  queryClient: QueryClient,
  ids: Array<number | string>,
): () => void {
  if (ids.length === 0) return () => {};
  const idSet = new Set(ids.map(String));
  cancelInflightListEmails(queryClient);
  const snapshots = captureSnapshots(queryClient);
  queryClient.setQueriesData<AnyPaginatedLike>(
    { predicate: (q) => isListEmailsQuery(q.queryKey) },
    (old) => {
      if (!old || !Array.isArray((old as any).emails)) return old;
      const emails = (old as any).emails as AnyEmailLike[];
      const filtered = emails.filter((e) => !idSet.has(String(e?.id)));
      if (filtered.length === emails.length) return old;
      const removed = emails.length - filtered.length;
      const total = typeof (old as any).total === "number"
        ? Math.max(0, (old as any).total - removed)
        : (old as any).total;
      return { ...(old as any), emails: filtered, total };
    },
  );
  return once(() => restoreSnapshots(queryClient, snapshots));
}
