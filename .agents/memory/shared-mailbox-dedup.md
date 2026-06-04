---
name: Shared-mailbox-aware email dedup
description: Why email dedup must be scoped by shared_mailbox_id, or shared-box copies vanish
---

# Le dedup des emails doit être scopé par `shared_mailbox_id`

Un même mail physique peut légitimement exister DEUX fois pour un utilisateur : une copie personnelle (envoyée/reçue, `shared_mailbox_id = null`) ET une copie reçue dans une boîte partagée (`shared_mailbox_id = <uuid>`). Les deux portent le MÊME RFC822 Message-ID (et souvent le même identifiant natif).

**Règle :** tout dedup d'emails doit comparer à `shared_mailbox_id` égal (null = boîte perso), JAMAIS globalement par utilisateur. Sinon la copie reçue en boîte partagée est jetée/supprimée car « doublon » de la copie perso → la boîte partagée reste vide. Le dedup INTRA-boîte reste correct (même `shared_mailbox_id`).

**Why:** symptôme réel — une boîte partagée OVH affichait 0 mail ; les copies reçues étaient déduppées contre les copies perso au même Message-ID (`duplicatesSkipped:1` à chaque cycle).

**How to apply:** scoper TOUTES les couches de dedup dans `auto-sync.ts` — les requêtes de `saveEmailWithTriage` (par suffixe natif d'`external_id`, par `provider_message_id`) ET le balayage de fond `dedupeUserEmailsByNativeId` (Pass 1 groupe par suffixe natif ; Pass 2 groupe déjà par contenu+shared). Supabase : `null` se filtre avec `.is("shared_mailbox_id", null)`, pas `.eq(..., null)`.
