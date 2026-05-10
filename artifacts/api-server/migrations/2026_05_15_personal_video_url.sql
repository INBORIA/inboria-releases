-- Permet à l'utilisateur qui choisit Teams ou Meet (sans calendrier compatible
-- branché) de fournir son propre lien permanent. Si rempli ET videoProvider in
-- (teams, meet) → on l'utilise tel quel au lieu du fallback Jitsi.
alter table public.profiles
  add column if not exists personal_video_url text null;
