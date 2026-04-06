import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGenerateDailySummary } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, AlertTriangle, TrendingUp, RefreshCw, CheckSquare, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";

export default function BilanQuotidien() {
  const generateSummary = useGenerateDailySummary();
  const [summaryData, setSummaryData] = useState<any>(null);

  const fetchSummary = () => {
    generateSummary.mutate(
      { data: { language: "fr" } },
      {
        onSuccess: (data) => {
          setSummaryData(data);
        },
      }
    );
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout>
      <div className="p-5 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Bilan Quotidien IA
            </h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">Votre resume personnalise pour demarrer la journee.</p>
          </div>
          <Button 
            onClick={fetchSummary} 
            disabled={generateSummary.isPending}
            size="sm"
            className="shrink-0 h-8 text-[12px]"
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${generateSummary.isPending ? 'animate-spin' : ''}`} />
            Regenerer
          </Button>
        </div>

        {generateSummary.isPending && !summaryData ? (
          <div className="bg-card rounded-lg border border-border p-8 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
            <h3 className="text-[13px] font-medium text-white">L'IA analyse votre boite mail...</h3>
            <p className="text-[12px] text-[#8b9cb3] mt-1 max-w-md">Lecture, tri et extraction des informations importantes.</p>
          </div>
        ) : !summaryData ? (
          <div className="bg-card rounded-lg border border-border border-dashed p-12 flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-8 h-8 text-[#8b9cb3]/30 mb-3" />
            <h3 className="text-[13px] font-medium text-white mb-1">Aucun bilan disponible</h3>
            <p className="text-[12px] text-[#8b9cb3] mb-3">Cliquez sur Regenerer pour obtenir votre bilan du jour.</p>
            <Button onClick={fetchSummary} size="sm" className="h-7 text-[11px]">
              <Sparkles className="w-3 h-3 mr-1.5" />
              Generer le bilan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3.5 relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 scale-110 translate-x-3 -translate-y-3">
                  <Sparkles className="w-16 h-16 text-primary" />
                </div>
                <p className="text-[10px] font-medium text-primary uppercase tracking-wider mb-0.5">Score serenite</p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-white tracking-tighter">{summaryData.score}</span>
                  <span className="text-[12px] text-[#8b9cb3] mb-0.5">/100</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${summaryData.score}%` }} />
                </div>
              </div>

              <div className="bg-card rounded-lg border border-red-500/20 bg-red-500/5 p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider">Urgences</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {summaryData.stats.urgent} <span className="text-[11px] font-normal text-[#8b9cb3]">a traiter</span>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-primary/20 bg-primary/5 p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Taches</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {summaryData.stats.pending} <span className="text-[11px] font-normal text-[#8b9cb3]">nouvelles</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border border-l-2 border-l-primary p-4">
              <h2 className="text-[13px] font-semibold text-white mb-2">Vue d'ensemble</h2>
              <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
                {summaryData.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 space-y-2">
                <h3 className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                  Emails cles a traiter
                </h3>
                {summaryData.keyEmails.length > 0 ? (
                  summaryData.keyEmails.map((email: any) => (
                    <div key={email.id} className="bg-card rounded-lg border border-border p-3 hover:bg-[#1a2235] transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-[12px] text-white">{email.sender}</span>
                        {email.priority === 'urgent' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-red-500/15 text-red-400 border-red-500/20">Urgent</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-amber-500/15 text-amber-400 border-amber-500/20">Important</span>
                        )}
                      </div>
                      <h4 className="text-[12px] text-[#8b9cb3] mb-1.5">{email.subject}</h4>
                      <p className="text-[11px] text-[#8b9cb3]/70 bg-background rounded p-2 border border-border">
                        {email.summary}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="bg-card rounded-lg border border-border border-dashed p-6 text-center">
                    <p className="text-[12px] text-[#8b9cb3]">Aucun email critique detecte.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Conseil du jour
                </h3>
                <div className="bg-card rounded-lg border border-border p-3.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[12px] text-[#8b9cb3] leading-relaxed italic">
                    "{summaryData.advice}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
