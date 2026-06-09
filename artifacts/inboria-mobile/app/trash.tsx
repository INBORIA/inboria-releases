import React from "react";

import { EmailListScreen } from "@/components/EmailListScreen";
import { listTrashed } from "@/lib/api";

export default function TrashScreen() {
  return (
    <EmailListScreen
      title="Corbeille"
      queryKey={["emails", "trashed"]}
      queryFn={() => listTrashed()}
      emptyIcon="trash-2"
      emptyTitle="Corbeille vide"
      emptySubtitle="Les e-mails supprimés apparaîtront ici."
    />
  );
}
