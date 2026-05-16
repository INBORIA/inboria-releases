import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Mail,
  Users,
  ShieldCheck,
  Brain,
  MessageSquare,
  Database,
  Sparkles,
  CreditCard,
  Send,
  Cloud,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminWaitlist from "./waitlist";
import AdminAbonnes from "./abonnes";
import AdminEmailBrain from "./email-brain";
import AdminInboria from "./inboria";
import AdminSupabase from "./supabase";
import AdminPaddle from "./paddle";
import AdminBrevo from "./brevo";
import AdminOpenAI from "./openai";
import AdminReplit from "./replit";
import AdminRentabilite from "./rentabilite";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

// Top-level: provider/scope
type TopTab =
  | "inboria"
  | "supabase"
  | "paddle"
  | "brevo"
  | "openai"
  | "replit"
  | "rentabilite";
// Sub-tab inside "inboria"
type InboriaSubTab = "waitlist" | "abonnes" | "email-brain" | "chat";

interface ParsedHash {
  top: TopTab;
  sub: InboriaSubTab;
}

const DEFAULT_SUB: InboriaSubTab = "waitlist";
const TOP_TABS: TopTab[] = [
  "inboria",
  "supabase",
  "paddle",
  "brevo",
  "openai",
  "replit",
  "rentabilite",
];

function isTopTab(v: string): v is TopTab {
  return (TOP_TABS as string[]).includes(v);
}

function parseHash(): ParsedHash {
  if (typeof window === "undefined") return { top: "inboria", sub: DEFAULT_SUB };
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return { top: "inboria", sub: DEFAULT_SUB };

  // Backward-compat: legacy flat hashes
  if (raw === "subscribers" || raw === "abonnes")
    return { top: "inboria", sub: "abonnes" };
  if (raw === "waitlist") return { top: "inboria", sub: "waitlist" };
  if (raw === "email-brain") return { top: "inboria", sub: "email-brain" };
  if (raw === "inboria") return { top: "inboria", sub: "chat" };
  if (isTopTab(raw)) return { top: raw, sub: DEFAULT_SUB };

  // New nested format: "inboria/<sub>" or "<top>"
  const [top, sub] = raw.split("/");
  if (top && isTopTab(top)) {
    if (top === "inboria") {
      if (sub === "abonnes" || sub === "email-brain" || sub === "chat" || sub === "waitlist")
        return { top: "inboria", sub };
      return { top: "inboria", sub: DEFAULT_SUB };
    }
    return { top, sub: DEFAULT_SUB };
  }
  return { top: "inboria", sub: DEFAULT_SUB };
}

function hashFor(top: TopTab, sub: InboriaSubTab): string {
  if (top === "inboria") return `#inboria/${sub}`;
  return `#${top}`;
}

export default function AdminIndex() {
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const [, setLocation] = useLocation();

  const initial = parseHash();
  const [topTab, setTopTab] = useState<TopTab>(initial.top);
  const [subTab, setSubTab] = useState<InboriaSubTab>(initial.sub);

  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      setLocation("/dashboard", { replace: true });
    }
  }, [profileLoading, isAdmin, setLocation]);

  function updateHash(top: TopTab, sub: InboriaSubTab) {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", hashFor(top, sub));
    }
  }

  function handleTopChange(value: string) {
    const next: TopTab = isTopTab(value) ? value : "inboria";
    setTopTab(next);
    updateHash(next, subTab);
  }

  function handleSubChange(value: string) {
    const next: InboriaSubTab =
      value === "abonnes"
        ? "abonnes"
        : value === "email-brain"
          ? "email-brain"
          : value === "chat"
            ? "chat"
            : "waitlist";
    setSubTab(next);
    updateHash(topTab, next);
  }

  if (profileLoading || !isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Admin</h1>
        </div>

        <Tabs value={topTab} onValueChange={handleTopChange} className="w-full">
          <TabsList
            className="bg-[#0d1117] border border-[#1f2937] flex flex-wrap h-auto"
            data-testid="tabs-admin"
          >
            <TabsTrigger value="inboria" data-testid="tab-inboria">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Inboria
            </TabsTrigger>
            <TabsTrigger value="supabase" data-testid="tab-supabase">
              <Database className="h-3.5 w-3.5 mr-1.5" />
              Supabase
            </TabsTrigger>
            <TabsTrigger value="paddle" data-testid="tab-paddle">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Paddle
            </TabsTrigger>
            <TabsTrigger value="brevo" data-testid="tab-brevo">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Brevo
            </TabsTrigger>
            <TabsTrigger value="openai" data-testid="tab-openai">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              OpenAI
            </TabsTrigger>
            <TabsTrigger value="replit" data-testid="tab-replit">
              <Cloud className="h-3.5 w-3.5 mr-1.5" />
              Replit
            </TabsTrigger>
            <TabsTrigger value="rentabilite" data-testid="tab-rentabilite">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Résultat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inboria" className="mt-4">
            <Tabs
              value={subTab}
              onValueChange={handleSubChange}
              className="w-full"
            >
              <TabsList
                className="bg-[#0d1117] border border-[#1f2937]"
                data-testid="tabs-admin-inboria"
              >
                <TabsTrigger value="waitlist" data-testid="subtab-waitlist">
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Liste d'attente
                </TabsTrigger>
                <TabsTrigger value="abonnes" data-testid="subtab-abonnes">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Abonnés
                </TabsTrigger>
                <TabsTrigger value="email-brain" data-testid="subtab-email-brain">
                  <Brain className="h-3.5 w-3.5 mr-1.5" />
                  Email Brain
                </TabsTrigger>
                <TabsTrigger value="chat" data-testid="subtab-chat">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Chat Inboria
                </TabsTrigger>
              </TabsList>

              <TabsContent value="waitlist" className="mt-4">
                <AdminWaitlist embedded />
              </TabsContent>
              <TabsContent value="abonnes" className="mt-4">
                <AdminAbonnes embedded />
              </TabsContent>
              <TabsContent value="email-brain" className="mt-4">
                <AdminEmailBrain />
              </TabsContent>
              <TabsContent value="chat" className="mt-4">
                <AdminInboria />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="supabase" className="mt-4">
            <AdminSupabase />
          </TabsContent>

          <TabsContent value="paddle" className="mt-4">
            <AdminPaddle />
          </TabsContent>

          <TabsContent value="brevo" className="mt-4">
            <AdminBrevo />
          </TabsContent>

          <TabsContent value="openai" className="mt-4">
            <AdminOpenAI />
          </TabsContent>

          <TabsContent value="replit" className="mt-4">
            <AdminReplit />
          </TabsContent>

          <TabsContent value="rentabilite" className="mt-4">
            <AdminRentabilite />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
