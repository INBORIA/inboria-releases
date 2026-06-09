import React from "react";

import { EmailListScreen } from "@/components/EmailListScreen";
import { listSnoozedEmails } from "@/lib/api";

export default function ReportesScreen() {
  return (
    <EmailListScreen
      title="Reportés"
      queryKey={["emails", "snoozed"]}
      queryFn={listSnoozedEmails}
      emptyIcon="bell-off"
      emptyTitle="Aucun e-mail reporté"
      emptySubtitle="Les e-mails que vous reportez réapparaîtront ici au moment voulu."
    />
  );
}
