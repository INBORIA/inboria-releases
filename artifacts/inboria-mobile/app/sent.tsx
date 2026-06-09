import React from "react";

import { EmailListScreen } from "@/components/EmailListScreen";
import { listSent } from "@/lib/api";

export default function SentScreen() {
  return (
    <EmailListScreen
      title="Envoyés"
      queryKey={["emails", "sent"]}
      queryFn={() => listSent()}
      showRecipient
      emptyIcon="send"
      emptyTitle="Aucun e-mail envoyé"
      emptySubtitle="Les messages que vous envoyez apparaîtront ici."
    />
  );
}
