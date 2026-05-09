-- RDV Phase 4 (#262) — Visioconférence intégrée
--
-- Ajoute aux appointments le lien de visio (Meet, Teams ou Jitsi) et au
-- profil utilisateur la préférence par défaut. Les liens Meet/Teams sont
-- générés via les API Google/Microsoft lors du push calendrier ; Jitsi
-- est généré côté serveur (URL publique, pas d'API requise).

alter table public.appointments
  add column if not exists video_provider text,
  add column if not exists video_url text,
  add column if not exists video_join_url text;

comment on column public.appointments.video_provider is
  'Fournisseur visio: meet|teams|jitsi|none. NULL = pas de visio.';
comment on column public.appointments.video_url is
  'URL canonique de la visio (lien à partager).';
comment on column public.appointments.video_join_url is
  'URL "Rejoindre maintenant" si différente du lien canonique (ex. Teams).';

alter table public.profiles
  add column if not exists preferred_video_provider text default 'none';

comment on column public.profiles.preferred_video_provider is
  'Préférence par défaut pour la visio dans les nouveaux RDV: meet|teams|jitsi|none.';
