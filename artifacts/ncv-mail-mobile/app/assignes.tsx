import React, { useCallback, useState } from "react";
import {
  useGetAssignedToMe,
  getGetAssignedToMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import MailListView from "@/components/MailListView";

export default function AssignedScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useGetAssignedToMe();
  const list = (Array.isArray(data) ? data : ((data as { emails?: unknown[] } | undefined)?.emails ?? [])) as never[];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getGetAssignedToMeQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <MailListView
      title="Assignés"
      subtitle="Mails qui te sont assignés"
      emails={list}
      isLoading={isLoading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      emptyIcon="account-arrow-right-outline"
      emptyTitle="Aucun mail assigné"
      emptyDesc="Tes mails assignés depuis les boîtes partagées apparaîtront ici."
    />
  );
}
