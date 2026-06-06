---
name: ncv-mail email-list cache persistence
description: Why/how React Query persistence is re-enabled but scoped to /api/emails only, to kill the login skeleton flash without the old blank-screen bug.
---

# Persistance du cache des listes de mails (anti-clignotement connexion)

À la connexion/rechargement, la Réception montrait un squelette ~1-2 s (mémoire
vide → fetch réseau). La persistance React Query (deps `@tanstack/*-persist*`
déjà installées, gcTime 1 jour) avait été DÉSACTIVÉE car `PersistQueryClientProvider`
provoquait un écran blanc au rechargement.

**Décision** : réactiver, mais de façon scopée et sûre.
- Persister UNIQUEMENT les requêtes `/api/emails` réussies (clé Orval =
  `['/api/emails', params]`, donc filtrer sur `queryKey[0]`). JAMAIS profil/orga/
  auth → évite de réhydrater une donnée au mauvais format dans un composant
  critique (cause probable de l'ancien écran blanc).
- Restaurer AVANT le 1er rendu (`main.tsx`) via `persistQueryClientRestore`, et
  démarrer l'app quand même après `Promise.race` 700 ms si ça traîne/échoue
  → jamais d'écran bloqué.
- **Isolation des comptes (sécurité B2B)** : le `buster` intègre l'id user
  (`v1:<userId>`, lu via `supabase.auth.getSession()` au restore). Le cache d'un
  autre compte sur poste partagé est jeté, jamais affiché.

**Why** : un email B2B ne doit jamais montrer, même 1 frame, les mails d'un autre
compte ; et on ne veut pas re-déclencher le blank-screen historique.

**How to apply** : si on étend la persistance à d'autres listes (catégories,
counts…), garder le scope par préfixe de clé + le buster lié à l'utilisateur, et
bumper `CACHE_BUSTER` à tout changement de forme des données persistées.
