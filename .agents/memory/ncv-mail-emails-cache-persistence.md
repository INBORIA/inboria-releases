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

**PIÈGE racine #2 — buster figé au boot (cache jeté à chaque login)** : le buster
d'isolation `v1:<userId>` était calculé UNE fois au boot via `readCurrentUserIdSync()`.
Lors d'une connexion FRAÎCHE, au boot aucun jeton n'est encore en localStorage →
userId = "anon" → l'abonnement de persistance (`persistQueryClientSubscribe`) sauvait
les mails sous `v1:anon`. Au rechargement suivant (désormais connecté), le boot lit
l'id réel → restore avec buster `v1:<realId>` ≠ `v1:anon` → `persistQueryClientRestore`
JETTE tout le cache → squelette à chaque 1er rechargement post-login. **Fix** :
re-clé du cache dès qu'une session apparaît — `onAuthStateChange((event, session))`
appelle `syncPersistedCacheOwner(session.user.id)` qui (si l'owner change) désabonne,
force un `persistQueryClientSave` immédiat sous `v1:<realId>` puis se réabonne.
Passage "anon"→realId NE purge PAS (on garde les mails chargés, on les ré-étiquette) ;
passage realId_A→realId_B purge (poste partagé). **Why** : un buster lié à l'identité
DOIT être recalculé quand l'identité arrive, pas figé à un instant où elle est absente.
**How to apply** : tout cache persisté étiqueté par utilisateur doit se re-keyer sur
l'évènement d'auth, jamais seulement au boot.

**Durcissement isolation B2B (poste partagé)** : `syncPersistedCacheOwner` purge
SYSTÉMATIQUEMENT (queryClient.clear + removeItem) à TOUT changement de propriétaire,
y compris "anon"→realId — car la mémoire restaurée au boot peut venir d'un blob
`v*:anon` laissé par un AUTRE compte. Ne jamais ré-étiqueter des mails d'origine
incertaine. Le no-op `userId === _persistOwnerId` protège le cas reload (sinon la
purge effacerait le cache fraîchement restauré → squelette). En plus, bumper le
buster (`v1`→`v2`) lors d'un correctif de ce type pour invalider d'office les caches
contaminés déjà présents chez les utilisateurs → coûte 1 MISS unique au prochain
reload puis HIT. **Why** : un cache à clé par-endpoint (`/api/emails`, non scopé user)
ne prouve pas la provenance ; seule la purge au changement d'identité garantit qu'un
compte ne voit jamais les mails d'un autre. Diagnostic console `[inboria] restore
cache: HIT/MISS` (temporaire) pour vérifier en prod.

**PIÈGE racine #3 — le squelette ne venait PLUS du cache, mais de la déconnexion** :
après les fixes buster/re-key, la matrice de repro réelle (confirmée par l'utilisateur +
témoins console temporaires `[inboria] boot/restore/auth event`) était : Ctrl+R connecté =
PAS de squelette (cache HIT, ~19 listes restaurées), redémarrage app = PAS de squelette,
**déconnexion→reconnexion = squelette**. Cause : `SIGNED_OUT` purgeait mémoire+disque
(sécurité) → à la reconnexion (SPA, sans rechargement) la liste se re-fetchait réellement
→ squelette LÉGITIME. Ne pas chasser une « théorie cache miss » : prouver d'abord, par
témoin, si le blob disque existe au boot (taille + buster stocké vs attendu) ET si un
`SIGNED_OUT` intempestif (verrou gotrue) vide le cache. Ici les deux étaient sains.
**Décision produit (validée user, revue architecte PASS)** : à `SIGNED_OUT` on garde la
mémoire VIVE (queryClient PAS vidé) pour réafficher instantanément le MÊME compte qui se
reconnecte dans la fenêtre ; on efface toujours le blob DISQUE + on coupe l'abonnement
(confidentialité : rien sur disque post-logout). Variable module `_lastOwnerId` (mémoire
onglet) survit au logout ; à `SIGNED_IN`, `syncPersistedCacheOwner` ne purge la mémoire que
si `userId !== _lastOwnerId` (compte DIFFÉRENT). **Why** : le seul moment où un squelette
restait était le re-fetch post-logout ; le supprimer sans rouvrir la faille inter-comptes
exige de distinguer « même compte » (garder RAM) de « autre compte » (purger RAM+disque).
**How to apply** : rétention RAM post-logout = compromis assumé (attaquant local même
onglet) ; ne JAMAIS étendre au disque. Tout nouveau cache user-scopé doit purger sur
changement d'identité, pas sur la simple déconnexion.

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
