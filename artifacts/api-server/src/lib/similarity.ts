// Helpers de détection de quasi-doublons pour les catégories utilisateur.
// Pas de dépendance externe : Levenshtein normalisé + seuil exporté.

export const CATEGORY_SIMILARITY_THRESHOLD = 0.75;

// Normalisation : minuscules, suppression des accents, suppression de la
// ponctuation/espaces, fusion en une seule chaîne alphanumérique.
// Permet d'attraper "Facturation" ↔ "facturation" ↔ "factur-ation".
export function normalizeForCompare(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Distance de Levenshtein classique (DP en ligne).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

// Longueur du préfixe commun (sur les chaînes déjà normalisées).
function commonPrefixLen(a: string, b: string): number {
  const m = Math.min(a.length, b.length);
  let i = 0;
  while (i < m && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

// Score normalisé entre 0 (totalement différents) et 1 (identiques après
// normalisation). Combine trois signaux pour ne pas rater :
//   - Levenshtein normalisé (cas général : fautes de frappe).
//   - Inclusion stricte ("Support" ⊂ "Support client" → 0.80).
//   - Préfixe commun long ("Facturation" / "Factures" partagent
//     "factur" sur 6 caractères → score = 6 / min(8,11) ≈ 0.75)
//     pour rattraper les variantes morphologiques (singulier/pluriel,
//     verbe/nom : "Comptable"/"Comptabilité", etc.).
export function similarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  // Cas dégénéré (ex. caractères non latins qui s'effondrent) :
  // on retombe sur une comparaison brute pour ne pas marquer comme
  // doublon deux noms réellement différents qui se vident tous deux.
  if (!na || !nb) {
    const ra = a.trim().toLowerCase();
    const rb = b.trim().toLowerCase();
    return ra && rb && ra === rb ? 1 : 0;
  }
  if (na === nb) return 1;

  const maxLen = Math.max(na.length, nb.length);
  const minLen = Math.min(na.length, nb.length);
  const dist = levenshtein(na, nb);
  const editScore = 1 - dist / maxLen;

  // Sous-chaîne : "support" ⊂ "supportclient" → score plancher 0.8.
  const containment =
    minLen >= 4 && (na.includes(nb) || nb.includes(na)) ? 0.8 : 0;

  // Préfixe commun : on exige >= 5 caractères partagés ET >= 70% du
  // mot le plus court, pour éviter les faux positifs courts du genre
  // "Test" / "Texte". Le score retourné est le ratio prefix/minLen.
  const cp = commonPrefixLen(na, nb);
  const prefixScore = cp >= 5 && cp / minLen >= 0.7 ? cp / minLen : 0;

  return Math.max(editScore, containment, prefixScore);
}

export type SimilarMatch = {
  id: number;
  name: string;
  similarity: number;
};

// Renvoie les catégories existantes qui ressemblent au nom proposé,
// triées par score décroissant. Vide si aucun match au-dessus du seuil.
export function findSimilarCategories(
  candidate: string,
  existing: ReadonlyArray<{ id: number; name: string }>,
  threshold: number = CATEGORY_SIMILARITY_THRESHOLD,
): SimilarMatch[] {
  const matches: SimilarMatch[] = [];
  for (const e of existing) {
    const score = similarity(candidate, e.name);
    if (score >= threshold) {
      matches.push({ id: e.id, name: e.name, similarity: score });
    }
  }
  matches.sort((a, b) => b.similarity - a.similarity);
  return matches;
}

export type DuplicatePair<T extends { id: number; name: string }> = {
  a: T;
  b: T;
  similarity: number;
};

// Cluster de catégories ayant TOUTES le même nom normalisé (doublons exacts).
// Apparaît typiquement quand auto-sync triage 100+ emails en parallèle sur
// la même valeur "Newsletters" : sans contrainte unique en DB, chaque INSERT
// passe et on se retrouve avec N copies. Au lieu d'afficher C(N,2) paires
// identiques à 100% (79 copies → 3081 lignes), on émet UN cluster que l'UI
// résout en une seule fusion massive vers le représentant.
export type DuplicateCluster<T extends { id: number; name: string }> = {
  // Représentant (à garder) : celui avec le plus d'emails, puis le plus
  // petit id pour stabilité. L'appelant peut surcharger via emailCount.
  representative: T;
  // Toutes les AUTRES catégories du cluster (à fusionner dans representative).
  duplicates: T[];
  // Compte total dans le cluster (= duplicates.length + 1).
  size: number;
};

export type DuplicateReport<T extends { id: number; name: string }> = {
  // Doublons exacts (même nom après normalisation). Un cluster = 1 fusion massive.
  clusters: DuplicateCluster<T>[];
  // Paires de noms DIFFÉRENTS mais qui se ressemblent (fautes, variantes…).
  // Calculées entre représentants seulement → pas de redondance.
  pairs: DuplicatePair<T>[];
};

// Détecte doublons exacts (clusters) + paires similaires (noms différents).
// emailCountOf permet de choisir le meilleur représentant (celui qui contient
// le plus d'emails — le moins coûteux à conserver). Sans cette fonction, le
// représentant est le plus petit id.
export function findDuplicateReport<T extends { id: number; name: string }>(
  categories: ReadonlyArray<T>,
  threshold: number = CATEGORY_SIMILARITY_THRESHOLD,
  emailCountOf?: (cat: T) => number,
): DuplicateReport<T> {
  // 1) Groupage par nom normalisé.
  const byNorm = new Map<string, T[]>();
  for (const c of categories) {
    const key = normalizeForCompare(c.name) || `__raw:${c.name.trim().toLowerCase()}`;
    const arr = byNorm.get(key);
    if (arr) arr.push(c);
    else byNorm.set(key, [c]);
  }

  // 2) Pour chaque groupe : choisir représentant, émettre cluster si size >= 2.
  const clusters: DuplicateCluster<T>[] = [];
  const representatives: T[] = [];
  for (const group of byNorm.values()) {
    // Représentant = max emails, puis min id pour stabilité.
    const rep = group.reduce((best, cur) => {
      const bc = emailCountOf ? emailCountOf(best) : 0;
      const cc = emailCountOf ? emailCountOf(cur) : 0;
      if (cc > bc) return cur;
      if (cc < bc) return best;
      return cur.id < best.id ? cur : best;
    });
    representatives.push(rep);
    if (group.length >= 2) {
      clusters.push({
        representative: rep,
        duplicates: group.filter((c) => c.id !== rep.id),
        size: group.length,
      });
    }
  }
  clusters.sort((a, b) => b.size - a.size);

  // 3) Paires similaires entre représentants UNIQUEMENT (évite redondance).
  const pairs: DuplicatePair<T>[] = [];
  for (let i = 0; i < representatives.length; i++) {
    for (let j = i + 1; j < representatives.length; j++) {
      const ci = representatives[i]!;
      const cj = representatives[j]!;
      const score = similarity(ci.name, cj.name);
      // < 1 : on exclut les similarity=1 (déjà couverts par les clusters).
      if (score >= threshold && score < 1) {
        pairs.push({ a: ci, b: cj, similarity: score });
      }
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity);

  return { clusters, pairs };
}

// Conservé pour compat tests/anciens appels : aplatit le rapport en paires.
// Chaque cluster est aplati en (size-1) paires (rep ↔ chaque duplicate).
// Préférer findDuplicateReport pour de nouveaux appels.
export function findDuplicatePairs<T extends { id: number; name: string }>(
  categories: ReadonlyArray<T>,
  threshold: number = CATEGORY_SIMILARITY_THRESHOLD,
): DuplicatePair<T>[] {
  const report = findDuplicateReport(categories, threshold);
  const out: DuplicatePair<T>[] = [];
  for (const c of report.clusters) {
    for (const d of c.duplicates) {
      out.push({ a: c.representative, b: d, similarity: 1 });
    }
  }
  return [...out, ...report.pairs];
}
