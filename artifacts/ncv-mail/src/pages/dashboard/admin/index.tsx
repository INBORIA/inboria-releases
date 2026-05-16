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
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminWaitlist from "./waitlist";
import AdminAbonnes from "./abonnes";
import AdminEmailBrain from "./email-brain";
import AdminInboria from "./inboria";
import AdminSupabase from "./supabase";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

// Top-level: provider/scope
type TopTab = "inboria" | "supabase";
// Sub-tab inside "inboria"
type InboriaSubTab = "waitlist" | "abonnes" | "email-brain" | "chat";

interface ParsedHash {
  top: TopTab;
  sub: InboriaSubTab;
}

const DEFAULT_SUB: InboriaSubTab = "waitlist";

function parseHash(): ParsedHash {
  if (typeof window === "undefined") return { top: "inboria", sub: DEFAULT_SUB };
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return { top: "inboria", sub: DEFAULT_SUB };

  // Backward-compat: legacy flat hashes
  if (raw === "supabase") return { top: "supabase", sub: DEFAULT_SUB };
  if (raw === "subscribers" || raw === "abonnes")
    return { top: "inboria", sub: "abonnes" };
  if (raw === "waitlist") return { top: "inboria", sub: "waitlist" };
  if (raw === "email-brain") return { top: "inboria", sub: "email-brain" };
  if (raw === "inboria") return { top: "inboria", sub: "chat" };

  // New nested format: "inboria/<sub>" or "supabase"
  const [top, sub] = raw.split("/");
  if (top === "supabase") return { top: "supabase", sub: DEFAULT_SUB };
  if (top === "inboria") {
    if (sub === "abonnes" || sub === "email-brain" || sub === "chat" || sub === "waitlist")
      return { top: "inboria", sub };
    return { top: "inboria", sub: DEFAULT_SUB };
  }
  return { top: "inboria", sub: DEFAULT_SUB };
}

function hashFor(top: TopTab, sub: InboriaSubTab): string {
  if (top === "supabase") return "#supabase";
  return `#inboria/${sub}`;
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
    const next: TopTab = value === "supabase" ? "supabase" : "inboria";
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
            className="bg-[#0d1117] border border-[#1f2937]"
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
