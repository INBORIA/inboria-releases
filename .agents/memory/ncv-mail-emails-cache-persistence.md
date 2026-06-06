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

**PIÈGE majeur (régression vécue)** : NE PAS appeler `supabase.auth.getSession()`
(ni aucune API auth qui prend le verrou gotrue `lock:sb-<ref>-auth-token`) sur le
chemin de restauration AVANT rendu. Ce verrou peut rester bloqué ~5 s (thrash de
verrou auth via les canaux realtime, cf. logs). La restauration dépasserait alors
la garde de 700 ms de `main.tsx` → app démarre sans cache → squelette gris
réapparaît. Lire l'id user en SYNCHRONE depuis localStorage (`sb-<ref>-auth-token`,
gérer le préfixe `base64-`) via `readCurrentUserIdSync()`. Règle générale : tout
ce qui s'exécute avant le 1er rendu doit éviter le verrou gotrue.

**Complément anti-flash — squelette RETARDÉ** : le cache seul réduit le flash mais
n'élimine pas les cas où `isLoading` est vrai une fraction de seconde (cache absent
après déconnexion, restore qui rate la 1ʳᵉ frame, gros chunk dashboard). Un squelette
qui apparaît <300 ms puis disparaît EST le clignotement perçu. Fix : hook
`useDelayedFlag(active, delayMs)` (timeout ~280 ms) — on n'affiche `EmailRowSkeleton`
que si le chargement dépasse le délai ; en dessous on rend un placeholder vide calme
(`<div min-h>`), pas de gris. **Why** : un squelette bref EST le flash, pas un fetch
lent. **How to apply** : appliquer le même pattern (drapeau retardé + placeholder
calme) à toute nouvelle liste mails (Envoyés/Programmés/Reportés/Tâches/Archives/
Mes dossiers/Partagées) plutôt que de gater le squelette directement sur `isLoading`.
