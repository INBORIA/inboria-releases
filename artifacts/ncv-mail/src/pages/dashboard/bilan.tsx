import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGenerateDailySummary } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ArrowRight, AlertTriangle, TrendingUp, RefreshCw, CheckSquare } from "lucide-react";
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Bilan Quotidien IA
            </h1>
            <p className="text-gray-500 mt-1">Votre résumé personnalisé pour démarrer la journée efficacement.</p>
          </div>
          <Button 
            onClick={fetchSummary} 
            disabled={generateSummary.isPending}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generateSummary.isPending ? 'animate-spin' : ''}`} />
            Régénérer le bilan
          </Button>
        </div>

        {generateSummary.isPending && !summaryData ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                <RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-medium text-gray-900">L'IA analyse votre boîte mail...</h3>
                <p className="text-gray-500 mt-2 max-w-md">Nous lisons, trions et extrayons les informations importantes de vos nouveaux messages.</p>
              </CardContent>
            </Card>
          </div>
        ) : summaryData ? (
          <div className="space-y-6">
            
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-primary text-primary-foreground border-none shadow-md overflow-hidden relative">
                <div className="absolute right-0 top-0 opacity-10 scale-150 transform translate-x-1/4 -translate-y-1/4">
                  <Sparkles className="w-32 h-32" />
                </div>
                <CardContent className="p-6 relative z-10">
                  <p className="text-primary-foreground/80 font-medium mb-1">Score de sérénité</p>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold tracking-tighter">{summaryData.score}</span>
                    <span className="text-xl opacity-80 mb-1">/100</span>
                  </div>
                  <Progress value={summaryData.score} className="h-1.5 mt-4 bg-primary-foreground/20" indicatorClassName="bg-white" />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6 flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <span className="text-gray-500 font-medium">Urgences</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">
                    {summaryData.stats.urgent} <span className="text-sm font-normal text-gray-500">à traiter</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6 flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <span className="text-gray-500 font-medium">Tâches extraites</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">
                    {summaryData.stats.pending} <span className="text-sm font-normal text-gray-500">nouvelles</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Summary Text */}
            <Card className="shadow-sm border-l-4 border-l-primary">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Vue d'ensemble</h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {summaryData.summary}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Key Emails */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-primary" />
                  Emails clés à traiter
                </h3>
                {summaryData.keyEmails.length > 0 ? (
                  summaryData.keyEmails.map((email: any) => (
                    <Card key={email.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-gray-900">{email.sender}</span>
                          {email.priority === 'urgent' ? (
                            <Badge variant="destructive">Urgent</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Important</Badge>
                          )}
                        </div>
                        <h4 className="text-md font-medium text-gray-800 mb-3">{email.subject}</h4>
                        <div className="bg-secondary rounded p-3 text-sm text-gray-700 border border-border">
                          {email.summary}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-dashed border-2 bg-transparent shadow-none">
                    <CardContent className="p-8 text-center text-gray-500">
                      Aucun email critique détecté pour le moment.
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* AI Advice */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Conseil du jour
                </h3>
                <Card className="bg-sidebar text-sidebar-foreground shadow-sm h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sidebar-foreground/90 leading-relaxed font-medium">
                      "{summaryData.advice}"
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
