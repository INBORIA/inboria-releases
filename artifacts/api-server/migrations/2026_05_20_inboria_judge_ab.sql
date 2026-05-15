-- Task #306 phase 5 — LLM-judge + A/B shadow runs.
--
-- Ajoute à `inboria_chat_logs` les colonnes nécessaires pour :
--  1) Scoring qualité des réponses Inboria via un LLM-judge (gpt-4o-mini)
--     qui note 0-100 chaque réponse + raison courte.
--  2) A/B shadow runs : sur un % paramétrable des requêtes mini, on lance
--     en parallèle (et en silence) un appel gpt-4o pour comparer offline
--     les deux variantes et décider si gpt-4o doit gagner du terrain.
--
-- Aucune fuite PII : pas de contenu de mail, juste le score + une raison
-- courte rédigée par le judge à partir de la question (déjà loguée).

alter table inboria_chat_logs
  add column if not exists judge_score smallint null,
  add column if not exists judge_reason text null,
  add column if not exists judge_model varchar(32) null,
  add column if not exists judge_latency_ms int null,
  add column if not exists judge_at timestamptz null,
  add column if not exists ab_variant varchar(16) null,
  add column if not exists ab_shadow_model varchar(32) null,
  add column if not exists ab_shadow_reply_len int null,
  add column if not exists ab_shadow_score smallint null,
  add column if not exists ab_shadow_latency_ms int null;

-- Index pour le dashboard admin (filtre rapide par fenêtre + score)
create index if not exists inboria_chat_logs_judge_score_idx
  on inboria_chat_logs (created_at desc, judge_score)
  where judge_score is not null;

create index if not exists inboria_chat_logs_ab_idx
  on inboria_chat_logs (created_at desc)
  where ab_variant is not null;
