# Roadmap Admin Inboria

## Structure cible (top-level tabs)

```
Admin
├── 🌟 Inboria              ✅ DONE
│   ├── Liste d'attente
│   ├── Abonnés
│   ├── Email Brain
│   └── Chat Inboria
├── 🗄️ Supabase             ✅ DONE (sous-tab Coûts à ajouter)
│   ├── Santé & Capacité
│   └── Coûts               ← TODO
├── 💳 Paddle               🚧 EN COURS
│   ├── Abonnements & MRR
│   └── Revenus (montant facturé brut + frais Paddle)  ← TODO
├── ✉️ Brevo                ← TODO
│   ├── Délivrabilité
│   └── Coûts
├── 🤖 OpenAI               ← TODO
│   ├── Usage & Latence
│   └── Coûts
├── 🚀 Replit               ← TODO
│   ├── Hosting & Logs
│   └── Coûts
└── 📊 Rentabilité          ← TODO (agrégateur top-level)
    ├── Vue globale (Revenus − Coûts = Marge nette)
    ├── Par abonné (ARPU, coût/user, marge/user, LTV)
    └── Par plan (essai / solo / pro / business)
```

## Convention

- **Pas de i18n dans Admin** : tout en français en dur (admin réservé au fondateur FR).
- **Pattern par onglet fournisseur** : bandeau santé + 3-5 cartes métriques + tableau paliers/historique + checklist prévention avec liens dashboard externe.
- **Pattern sous-tab Coûts** : carte "coût mensuel actuel" + tableau historique 12 mois + projection 30j.

## Données coûts — sources

| Provider | Source | Méthode |
|---|---|---|
| Supabase | Constante code | Plan Pro $25 + tier compute (Nano $0, Small $15, etc.) |
| Paddle | API Paddle transactions | Frais ~5% + 0.50€/tx |
| Brevo | API Brevo usage | Pull live |
| OpenAI | API OpenAI Usage endpoint | Pull live, cache 1h |
| Replit | Pas d'API publique | Saisie manuelle ou snapshot mensuel |

## Migration future à appliquer manuellement

`artifacts/api-server/migrations/<date>_monthly_cost_snapshots.sql` — table avec colonnes :
`month, revenue_total, cost_supabase, cost_openai, cost_brevo, cost_replit, paddle_fees, margin_net, active_users, paying_users, created_at`.

Cron mensuel le 1er du mois → INSERT snapshot agrégé du mois précédent. Granularité mois (pas jour).

## Ordre d'exécution restant

1. ✅ Inboria container + Supabase
2. 🚧 Paddle (Abonnements & MRR uniquement — sous-tab Revenus plus tard)
3. ⏭ OpenAI (Usage + Coûts)
4. ⏭ Brevo (Délivrabilité + Coûts)
5. ⏭ Replit (Hosting + Coûts saisie manuelle)
6. ⏭ Sous-tab Coûts pour Supabase + Paddle (Revenus)
7. ⏭ Migration `monthly_cost_snapshots` + cron mensuel
8. ⏭ Onglet Rentabilité (agrégateur)
