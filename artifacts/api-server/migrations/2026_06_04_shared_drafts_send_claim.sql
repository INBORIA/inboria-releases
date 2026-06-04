-- T005 — coordination « qui envoie » sur brouillon partagé.
-- Permet à un membre de « prendre l'envoi » d'un brouillon partagé : les autres
-- voient alors leur bouton Envoyer verrouillé (anti double-envoi). La valeur est
-- persistée pour survivre à un rechargement de page.
alter table shared_drafts
  add column if not exists send_claimed_by uuid,
  add column if not exists send_claimed_at timestamptz;
