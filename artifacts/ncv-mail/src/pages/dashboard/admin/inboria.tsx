import { useEffect, useState } from "react";
import { Loader2, Brain, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface InboriaStats {
  windowDays: number;
  totalLogs: number;
  byModel: Record<string, number>;
  fallback: { triggered: number; rate: number };
  reformulation: { flagged: number; rate: number };
  latency: { p50: number; p95: number; avg: number };
  judge: {
    scored: number;
    avg: number | null;
    p50: number | null;
    byModel: Record<string, { count: number; avg: number }>;
  };
  ab: {
    shadowCount: number;
    miniAvg: number | null;
    shadowAvg: number | null;
    delta: number | null;
  };
  topFallbackReasons: Array<{ reason: string; count: number }>;
  recentLowScore: Array<{
    id: string;
    question: string;
    score: number;
    model: string;
    createdAt: string;
  }>;
}

export default function AdminInboria() {
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<InboriaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(d: number) {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        setError("Session expirée, reconnectez-vous.");
        return;
      }
      const res = await fetch(`${baseUrl}/api/admin/inboria-stats?days=${d}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Erreur ${res.status}`);
        return;
      }
      setStats(json as InboriaStats);
    } catch (e: any) {
      setError(e?.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(days);
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-white">
            Stats chat Inboria
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                days === d
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-[#0d1117] border-[#1f2937] text-[#8b95a7] hover:text-white"
              }`}
            >
              {d === 1 ? "24 h" : `${d} j`}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {stats && !loading && (
        <>
          {/* Cartes top-level */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card title="Volume total" value={stats.totalLogs.toLocaleString()} />
            <Card
              title="Taux de fallback"
              value={`${(stats.fallback.rate * 100).toFixed(1)}%`}
              sub={`${stats.fallback.triggered} déclenchés`}
              tone={stats.fallback.rate > 0.05 ? "warn" : "ok"}
            />
            <Card
              title="Reformulations"
              value={`${(stats.reformulation.rate * 100).toFixed(1)}%`}
              sub={`${stats.reformulation.flagged} questions retapées`}
              tone={stats.reformulation.rate > 0.08 ? "warn" : "ok"}
            />
            <Card
              title="Score judge moyen"
              value={
                stats.judge.avg !== null ? `${stats.judge.avg.toFixed(1)}/100` : "—"
              }
              sub={`${stats.judge.scored} évalués`}
              tone={
                stats.judge.avg !== null && stats.judge.avg < 70 ? "warn" : "ok"
              }
            />
          </div>

          {/* Latency + répartition modèle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Latence (ms)
              </h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="p50" value={stats.latency.p50} />
                <Stat label="p95" value={stats.latency.p95} />
                <Stat label="avg" value={stats.latency.avg} />
              </div>
            </div>
            <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Répartition
                modèle
              </h3>
              <div className="space-y-2 text-sm">
                {Object.entries(stats.byModel).map(([model, count]) => {
                  const judgeForModel = stats.judge.byModel[model];
                  return (
                    <div
                      key={model}
                      className="flex items-center justify-between text-[#b8c5d6]"
                    >
                      <span className="font-mono text-xs">{model}</span>
                      <span>
                        {count.toLocaleString()}
                        {judgeForModel ? (
                          <span className="ml-2 text-[#6b7280]">
                            (score {judgeForModel.avg.toFixed(1)})
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* A/B comparison */}
          {stats.ab.shadowCount > 0 && (
            <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] p-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                A/B mini vs gpt-4o (shadow runs)
              </h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat
                  label="Échantillon"
                  value={stats.ab.shadowCount.toLocaleString()}
                />
                <Stat
                  label="Score mini"
                  value={
                    stats.ab.miniAvg !== null
                      ? `${stats.ab.miniAvg.toFixed(1)}`
                      : "—"
                  }
                />
                <Stat
                  label="Score gpt-4o"
                  value={
                    stats.ab.shadowAvg !== null
                      ? `${stats.ab.shadowAvg.toFixed(1)}`
                      : "—"
                  }
                />
              </div>
              {stats.ab.delta !== null && (
                <div
                  className={`mt-3 text-sm ${
                    stats.ab.delta > 5
                      ? "text-yellow-400"
                      : stats.ab.delta < -2
                        ? "text-green-400"
                        : "text-[#8b95a7]"
                  }`}
                >
                  Δ gpt-4o − mini = {stats.ab.delta > 0 ? "+" : ""}
                  {stats.ab.delta.toFixed(1)} pts
                </div>
              )}
            </div>
          )}

          {/* Top fallback reasons */}
          {stats.topFallbackReasons.length > 0 && (
            <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] p-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Top raisons de fallback
              </h3>
              <div className="space-y-1 text-sm">
                {stats.topFallbackReasons.map((r) => (
                  <div
                    key={r.reason}
                    className="flex items-center justify-between text-[#b8c5d6]"
                  >
                    <span className="font-mono text-xs">{r.reason}</span>
                    <span>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worst scores */}
          {stats.recentLowScore.length > 0 && (
            <div className="rounded-lg border border-[#1f2937] bg-[#0d1117] p-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Pires réponses récentes (à reviewer)
              </h3>
              <div className="space-y-2 text-sm">
                {stats.recentLowScore.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start gap-3 py-2 border-b border-[#1f2937] last:border-b-0"
                  >
                    <span className="text-xs font-mono text-red-400 w-12 shrink-0">
                      {row.score}/100
                    </span>
                    <span className="text-xs font-mono text-[#6b7280] w-20 shrink-0">
                      {row.model}
                    </span>
                    <span className="text-[#b8c5d6] flex-1 truncate">
                      {row.question}
                    </span>
                    <span className="text-xs text-[#6b7280] shrink-0">
                      {new Date(row.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({
  title,
  value,
  sub,
  tone = "ok",
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "warn"
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-[#1f2937] bg-[#0d1117]"
      }`}
    >
      <div className="text-xs text-[#8b95a7] mb-1">{title}</div>
      <div
        className={`text-2xl font-semibold ${
          tone === "warn" ? "text-yellow-400" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-[#6b7280] mt-1">{sub}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-[#8b95a7]">{label}</div>
      <div className="text-base font-semibold text-white">
        {typeof value === "number" ? Math.round(value).toLocaleString() : value}
      </div>
    </div>
  );
}
