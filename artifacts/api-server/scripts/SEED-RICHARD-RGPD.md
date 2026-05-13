# Seed Richard Martin — Registre RGPD

## Finalité du traitement
Entrainement et evaluation qualite du moteur Inboria (chat IA + memoire) sur des
donnees professionnelles realistes, sans exposer les donnees reelles
d'utilisateurs. Test de la couverture multi-langue, multi-projet, refus mails
prives, journalisation acces admin.

## Donnees seedees
- 20 projets B2B (references `RM-001` a `RM-020`) chez Richard Martin
  (`jj.neybergh@xchangesuite.com`, user_id `1d04a551-...`).
- ~200 mails de projet (10 par projet) dans la boite partagee
  `6c04623f-...`, assignes a Richard.
- 10 mails marques `is_private = true` (sujets neutres : conges, RDV perso,
  mutuelle, teletravail, anniversaire) — JAMAIS exposes a l'admin via Inboria.

## Garanties RGPD appliquees
| Principe | Implementation |
|---|---|
| Minimisation | Pas d'IBAN, NAS, n° tel, donnees sante/origine/religion/politique. |
| Pas de personnes reelles | Domaines RFC 2606 (`.test`, `.example`) — JAMAIS routables. Noms generiques (initiales) — pas d'homonyme exploitable. |
| Tracabilite | `external_id` prefixe `seed:richard:` + tag HTML `<!-- inboria-seed-richard v1 -->` en fin de body. |
| Reversibilite | `purge-richard-seed.ts` : 1 commande, supprime tous les `external_id LIKE 'seed:richard:%'` + projets `RM-*`. Idempotent. |
| Limitation conservation | Seed retire apres validation des tests (typiquement 7 jours). |
| Securite | Service role local uniquement, jamais d'envoi SMTP externe, jamais d'OAuth utilisateur sollicite. |
| Confidentialite collab | 10 mails `is_private=true` testent le respect du marquage prive : Inboria DOIT refuser de les exposer a JJ (admin), meme en mode equipe / Pile de Richard. |

## Garde-fous Inboria deja en place (verifies)
- Migration `2026_05_01_admin_team_access.sql` : colonne `is_private` + table immuable `admin_team_access_log`.
- Route `/admin/team-access-log?scope=mine` : tout collaborateur peut consulter qui a accede a ses donnees.
- Route `inboria-context.ts` mode admin team : exclusion des mails prives lors de l'elargissement du contexte.

## A traiter plus tard (hors scope seed)
1. UI marquage prive (clic droit / HoverActions) — la donnee existe, le geste UI manque.
2. Mode "successeur" 1-clic a la desactivation d'un compte (formaliser raison documentee).
3. Reroute auto entrants apres desactivation (X mois).
4. Export portabilite art. 20 RGPD (telechargement par le collab sortant de ses donnees pro).
5. Banniere d'info collab a l'arrivee.

## Commandes
```bash
# Creer le seed (idempotent — re-execute ne dupliques rien)
pnpm --filter @workspace/api-server exec tsx scripts/seed-richard.ts

# Purger entierement
pnpm --filter @workspace/api-server exec tsx scripts/purge-richard-seed.ts

# Verifier la couverture par les tests
pnpm --filter @workspace/api-server exec tsx scripts/challenge-inboria.ts
```
