import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SnoozedPanel } from "@/components/dashboard/snoozed-panel";
import { MailPageHeader } from "@/components/email-list/MailPageHeader";
import { useEnableLightTheme } from "@/lib/inbox-theme";

// task #293 — Cette page autonome est conservée pour rétro-compat (anciens
// liens externes). En interne, /dashboard/reportes monte désormais Dashboard
// qui rend le SnoozedPanel inline. Si jamais on revient ici, on rend la
// même UI à l'identique.
export default function Reportes() {
  useEnableLightTheme();
  return (
    <DashboardLayout>
      <MailPageHeader currentTab="reportes" />
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        <BackToInboxButton />
        <SnoozedPanel />
      </div>
    </DashboardLayout>
  );
}
