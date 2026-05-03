import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Brain, AlertCircle, CheckCircle2 } from "lucide-react";

interface BackfillResponse {
  ok: boolean;
  enqueued?: number;
  pendingTotal?: number;
  limit?: number;
  error?: string;
}

export default function AdminEmailBrain() {
  const [limit, setLimit] = useState("5000");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BackfillResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBackfill() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        limit: Math.max(1, Math.min(20000, Number(limit) || 5000)),
      };
      if (userId.trim()) body["userId"] = userId.trim();

      const res = await fetch("/api/admin/email-brain/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as BackfillResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || `Erreur ${res.status}`);
      } else {
        setResult(json);
      }
    } catch (err: any) {
      setError(err?.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-white">
            Indexation sémantique du corpus de mails
          </h2>
        </div>
        <p className="text-sm text-gray-400">
          Lance l'indexation vectorielle des mails non encore indexés pour
          permettre à Inboria de les retrouver par recherche sémantique
          (au-delà des 50 derniers). Coût estimé :{" "}
          <span className="text-gray-300">~0,03 $ pour 1 000 mails</span>{" "}
          (modèle text-embedding-3-small). Le traitement se fait en arrière-plan,
          progression visible dans les logs serveur.
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bf-userid" className="text-gray-300">
              Utilisateur ciblé (UUID, optionnel)
            </Label>
            <Input
              id="bf-userid"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="laisser vide = tous les utilisateurs"
              className="bg-[#161b22] border-[#1f2937] text-gray-200"
              disabled={loading}
              data-testid="input-userid"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bf-limit" className="text-gray-300">
              Nombre max de mails à traiter (1 — 20 000)
            </Label>
            <Input
              id="bf-limit"
              type="number"
              min={1}
              max={20000}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="bg-[#161b22] border-[#1f2937] text-gray-200"
              disabled={loading}
              data-testid="input-limit"
            />
          </div>

          <Button
            onClick={handleBackfill}
            disabled={loading}
            className="w-full sm:w-auto"
            data-testid="button-backfill"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Lancement…
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Lancer le backfill
              </>
            )}
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Échec</div>
              <div className="opacity-80">{error}</div>
              {error.toLowerCase().includes("not found") ||
              error.toLowerCase().includes("does not exist") ? (
                <div className="mt-2 text-xs opacity-80">
                  La table <code>email_chunks</code> n'existe pas encore.
                  Appliquez d'abord la migration SQL dans le Dashboard
                  Supabase :{" "}
                  <code>migrations/2026_05_03_email_chunks.sql</code>.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {result?.ok ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Backfill lancé</div>
              <div className="opacity-90">
                {result.enqueued} mail(s) en file (total en attente :{" "}
                {result.pendingTotal}). Traitement asynchrone, suivez
                l'avancement dans les logs serveur (recherche{" "}
                <code>email-brain-backfill</code>).
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] p-5 text-sm text-gray-400 space-y-2">
        <div className="font-medium text-gray-300">
          Pré-requis (à faire une seule fois en prod)
        </div>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Appliquer la migration SQL{" "}
            <code className="text-gray-300">
              migrations/2026_05_03_email_chunks.sql
            </code>{" "}
            dans le SQL Editor du Dashboard Supabase.
          </li>
          <li>
            Lancer le backfill ci-dessus une fois (ensuite les nouveaux mails
            sont indexés automatiquement toutes les 15 minutes).
          </li>
        </ol>
      </div>
    </div>
  );
}
