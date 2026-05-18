import React, { useCallback, useState } from "react";
import { useListEmails, getListEmailsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import MailListView from "@/components/MailListView";

export default function SentScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useListEmails({ status: "sent" as never, limit: 100 });
  const emails = (data as { emails?: unknown[] } | undefined)?.emails as never[] | undefined;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <MailListView
      title="Envoyés"
      subtitle="Messages que tu as envoyés"
      emails={emails}
      isLoading={isLoading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      emptyIcon="send-outline"
      emptyTitle="Aucun mail envoyé"
      emptyDesc="Tes mails envoyés apparaîtront ici."
      showRecipient
    />
  );
}
