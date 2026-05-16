import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetProfile } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Users, ShieldCheck, Brain, MessageSquare, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import AdminWaitlist from "./waitlist";
import AdminAbonnes from "./abonnes";
import AdminEmailBrain from "./email-brain";
import AdminInboria from "./inboria";
import AdminInfrastructure from "./infrastructure";

interface ProfileWithAdmin {
  isAdmin?: boolean;
}

type AdminTab = "waitlist" | "subscribers" | "email-brain" | "inboria" | "infrastructure";

function readTabFromHash(): AdminTab {
  if (typeof window === "undefined") return "waitlist";
  if (window.location.hash === "#subscribers") return "subscribers";
  if (window.location.hash === "#email-brain") return "email-brain";
  if (window.location.hash === "#inboria") return "inboria";
  if (window.location.hash === "#infrastructure") return "infrastructure";
  return "waitlist";
}

export default function AdminIndex() {
  const { t } = useTranslation();
  const { data: profileData, isLoading: profileLoading } = useGetProfile();
  const profile = (profileData ?? {}) as ProfileWithAdmin;
  const isAdmin = !!profile.isAdmin;
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<AdminTab>(readTabFromHash);

  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      setLocation("/dashboard", { replace: true });
    }
  }, [profileLoading, isAdmin, setLocation]);

  function handleTabChange(value: string) {
    const next: AdminTab =
      value === "subscribers"
        ? "subscribers"
        : value === "email-brain"
          ? "email-brain"
          : value === "inboria"
            ? "inboria"
            : value === "infrastructure"
              ? "infrastructure"
              : "waitlist";
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${next}`);
    }
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
          <h1 className="text-xl font-bold text-white">{t("sidebar.admin")}</h1>
        </div>

        <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
          <TabsList
            className="bg-[#0d1117] border border-[#1f2937]"
            data-testid="tabs-admin"
          >
            <TabsTrigger value="waitlist" data-testid="tab-waitlist">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              {t("admin.waitlistTitle")}
            </TabsTrigger>
            <TabsTrigger value="subscribers" data-testid="tab-subscribers">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              {t("admin.subscribersTitle")}
            </TabsTrigger>
            <TabsTrigger value="email-brain" data-testid="tab-email-brain">
              <Brain className="h-3.5 w-3.5 mr-1.5" />
              Email Brain
            </TabsTrigger>
            <TabsTrigger value="inboria" data-testid="tab-inboria">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Chat Inboria
            </TabsTrigger>
            <TabsTrigger value="infrastructure" data-testid="tab-infrastructure">
              <Server className="h-3.5 w-3.5 mr-1.5" />
              Infrastructure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="waitlist" className="mt-4">
            <AdminWaitlist embedded />
          </TabsContent>
          <TabsContent value="subscribers" className="mt-4">
            <AdminAbonnes embedded />
          </TabsContent>
          <TabsContent value="email-brain" className="mt-4">
            <AdminEmailBrain />
          </TabsContent>
          <TabsContent value="inboria" className="mt-4">
            <AdminInboria />
          </TabsContent>
          <TabsContent value="infrastructure" className="mt-4">
            <AdminInfrastructure />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
