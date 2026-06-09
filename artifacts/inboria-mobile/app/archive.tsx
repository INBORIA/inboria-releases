import React from "react";

import { EmailListScreen } from "@/components/EmailListScreen";
import { listArchived } from "@/lib/api";

export default function ArchiveScreen() {
  return (
    <EmailListScreen
      title="Archives"
      queryKey={["emails", "archived"]}
      queryFn={() => listArchived()}
      emptyIcon="archive"
      emptyTitle="Aucune archive"
      emptySubtitle="Les e-mails archivés apparaîtront ici."
    />
  );
}
