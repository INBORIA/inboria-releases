import OpenAI from "openai";
import { logger } from "../lib/logger";

/**
 * Point n°5 (montée en charge vers 5000 abonnés) — client OpenAI partagé +
 * limiteur de débit GLOBAL au niveau du process.
 *
 * Avant : ~18 instances `new OpenAI(...)` éparpillées (services workers ET
 * routes HTTP), aucune coordination → en pic (relève parallèle + triage IA +
 * embeddings + chatbots + suggestions UI) on pouvait lancer des dizaines
 * d'appels OpenAI en même temps → 429 (rate limit) en cascade et budget qui
 * explose.
 *
 * Ici on expose UN seul client, dont `chat.completions.create` et
 * `embeddings.create` passent par une « porte » de concurrence globale
 * (sémaphore). Tous les sites d'appel importent ce client : impossible d'en
 * oublier un, et les ~50 lignes `openai.xxx.create({...})` existantes restent
 * inchangées (même signature, même typage).
 *
 * Réglages (variables d'env, valeurs par défaut volontairement généreuses pour
 * ne RIEN ralentir aujourd'hui — le plafond ne mord qu'en cas de pic) :
 *  - OPENAI_MAX_CONCURRENCY : nb max d'appels OpenAI simultanés (défaut 8).
 *  - OPENAI_MAX_RETRIES     : retries SDK (429/5xx, backoff + Retry-After) (défaut 4).
 */

const MAX_CONCURRENCY = (() => {
  const raw = Number(process.env["OPENAI_MAX_CONCURRENCY"]);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 8;
})();

const MAX_RETRIES = (() => {
  const raw = Number(process.env["OPENAI_MAX_RETRIES"]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 4;
})();

// ---------------------------------------------------------------------------
// Sémaphore global : au plus MAX_CONCURRENCY appels OpenAI « en vol » à la fois.
// Les appels en excès attendent leur tour dans une file FIFO.
//
// Implémentation « à transfert de permis » (reservation-safe) : à la libération,
// si un appel attend, on lui CÈDE directement le permis (on ne décrémente PAS
// `active`). Sinon on décrémente. Ainsi un nouvel appel ne peut jamais voler le
// créneau d'un appelant déjà en file, et `active` ne dépasse jamais le plafond
// (le bug classique « décrémente puis réveille » autorisait un dépassement
// transitoire + une violation FIFO).
// ---------------------------------------------------------------------------
let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) {
    // Transfert : le permis libéré passe directement au suivant en file,
    // `active` reste inchangé (le créneau ne se libère pas réellement).
    next();
  } else {
    active--;
  }
}

async function gate<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Diagnostic léger (exposé pour un éventuel endpoint admin futur). */
export function aiLimiterStats() {
  return { active, queued: waiters.length, maxConcurrency: MAX_CONCURRENCY };
}

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
  maxRetries: MAX_RETRIES,
});

// Enrobe les deux méthodes réseau utilisées partout. On conserve la signature
// d'origine (overloads streaming/non-streaming) pour les appelants ; le `any`
// est strictement confiné à ce module.
const origChatCreate = client.chat.completions.create.bind(client.chat.completions);
(client.chat.completions as any).create = (...args: any[]) =>
  gate(() => (origChatCreate as any)(...args));

const origEmbedCreate = client.embeddings.create.bind(client.embeddings);
(client.embeddings as any).create = (...args: any[]) =>
  gate(() => (origEmbedCreate as any)(...args));

logger.info(
  { maxConcurrency: MAX_CONCURRENCY, maxRetries: MAX_RETRIES },
  "[ai-client] shared OpenAI client ready (global concurrency gate)",
);

/** Client OpenAI partagé, à importer partout (jamais `new OpenAI()` ailleurs). */
export const openai = client;
