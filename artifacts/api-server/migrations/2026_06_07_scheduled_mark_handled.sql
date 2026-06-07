-- Envoi programmé : marquage "traité" du mail d'origine.
--
-- Quand on TRANSFÈRE (ou répond à) un mail tout de suite, le mail d'origine est
-- marqué "traité" (handled_at) au moment de l'envoi. Pour un envoi PROGRAMMÉ, le
-- transfert part plus tard via le worker ; il faut donc mémoriser sur la ligne
-- programmée QUEL mail d'origine marquer "traité" une fois l'envoi réussi.
--
-- Pour une RÉPONSE programmée, reply_to_email_id suffit déjà (le worker s'en
-- sert). Pour un TRANSFERT programmé, reply_to_email_id reste volontairement NULL
-- (un transfert n'est pas une réponse, cf. classement "Envoyés") → d'où cette
-- colonne dédiée scheduled_mark_handled_id.
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS scheduled_mark_handled_id bigint;
