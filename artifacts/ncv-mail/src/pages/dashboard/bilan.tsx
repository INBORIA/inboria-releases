import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGenerateDailySummary } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Bilan Quotidien IA
            </h1>
            <p className="text-[13px] text-[#8b9cb3] mt-1">Votre resume personnalise pour demarrer la journee.</p>
          </div>
          <Button 
            onClick={fetchSummary} 
            disabled={generateSummary.isPending}
            size="sm"
            className="shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${generateSummary.isPending ? 'animate-spin' : ''}`} />
            Regenerer
          </Button>
        </div>

        {generateSummary.isPending && !summaryData ? (
          <div className="bg-card rounded-lg border border-border p-12 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-10 h-10 text-primary animate-spin mb-4" />
            <h3 className="text-sm font-medium text-white">L'IA analyse votre boite mail...</h3>
            <p className="text-[13px] text-[#8b9cb3] mt-2 max-w-md">Lecture, tri et extraction des informations importantes.</p>
          </div>
        ) : !summaryData ? (
          <div className="bg-card rounded-lg border border-border border-dashed p-16 flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-12 h-12 text-[#8b9cb3]/30 mb-4" />
            <h3 className="text-sm font-medium text-white mb-1">Aucun bilan disponible</h3>
            <p className="text-[13px] text-[#8b9cb3] mb-4">Cliquez sur Regenerer pour obtenir votre bilan du jour.</p>
            <Button onClick={fetchSummary} size="sm">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Generer le bilan
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-5 relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 scale-125 translate-x-4 -translate-y-4">
                  <Sparkles className="w-20 h-20 text-primary" />
                </div>
                <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-1">Score serenite</p>
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-bold text-white tracking-tighter">{summaryData.score}</span>
                  <span className="text-sm text-[#8b9cb3] mb-1">/100</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${summaryData.score}%` }} />
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-red-500/10 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-[11px] font-medium text-[#8b9cb3] uppercase tracking-wider">Urgences</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {summaryData.stats.urgent} <span className="text-sm font-normal text-[#8b9cb3]">a traiter</span>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <CheckSquare className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-[11px] font-medium text-[#8b9cb3] uppercase tracking-wider">Taches</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {summaryData.stats.pending} <span className="text-sm font-normal text-[#8b9cb3]">nouvelles</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border border-l-2 border-l-primary p-6">
              <h2 className="text-sm font-semibold text-white mb-3">Vue d'ensemble</h2>
              <p className="text-[14px] text-[#8b9cb3] leading-relaxed">
                {summaryData.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-[13px] font-semibold text-white flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  Emails cles a traiter
                </h3>
                {summaryData.keyEmails.length > 0 ? (
                  summaryData.keyEmails.map((email: any) => (
                    <div key={email.id} className="bg-card rounded-lg border border-border p-4 hover:bg-[#1a2235] transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-[13px] text-white">{email.sender}</span>
                        {email.priority === 'urgent' ? (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-[11px]">Urgent</Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[11px]">Important</Badge>
                        )}
                      </div>
                      <h4 className="text-[13px] text-[#8b9cb3] mb-2">{email.subject}</h4>
                      <p className="text-[12px] text-[#8b9cb3]/70 bg-background rounded p-2.5 border border-border">
                        {email.summary}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="bg-card rounded-lg border border-border border-dashed p-8 text-center">
                    <p className="text-[13px] text-[#8b9cb3]">Aucun email critique detecte.</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Conseil du jour
                </h3>
                <div className="bg-card rounded-lg border border-border p-5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-[13px] text-[#8b9cb3] leading-relaxed italic">
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
