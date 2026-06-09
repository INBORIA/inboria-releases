import { useLocalSearchParams } from "expo-router";
import React from "react";

import { EmailListScreen } from "@/components/EmailListScreen";
import { listFolderEmails } from "@/lib/api";

export default function FolderScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return (
    <EmailListScreen
      title={name || "Dossier"}
      queryKey={["folders", id, "emails"]}
      queryFn={() => listFolderEmails(String(id))}
      emptyIcon="folder"
      emptyTitle="Dossier vide"
      emptySubtitle="Aucun e-mail dans ce dossier."
    />
  );
}
