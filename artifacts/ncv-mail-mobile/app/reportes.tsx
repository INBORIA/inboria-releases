import React, { useCallback, useState } from "react";
import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListEmails,
  useUnsnoozeEmail,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import MailListView from "@/components/MailListView";
import { useColors } from "@/hooks/useColors";

export default function SnoozedScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useListEmails({ status: "snoozed" as never, limit: 100 });
  const emails = (data as { emails?: unknown[] } | undefined)?.emails as never[] | undefined;
  const unsnooze = useUnsnoozeEmail();

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <MailListView
      title="Reportés"
      subtitle="Mails snoozés, à reprendre plus tard"
      emails={emails}
      isLoading={isLoading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      emptyIcon="alarm-snooze"
      emptyTitle="Aucun mail reporté"
      emptyDesc="Reporte un mail depuis sa fiche pour le voir ici."
      rightAction={(item) => (
        <Pressable
          onPress={() =>
            unsnooze.mutate(
              { id: item.id as number },
              { onSuccess: refresh }
            )
          }
          hitSlop={10}
        >
          <MaterialCommunityIcons name="inbox-arrow-down" size={18} color={colors.primary} />
        </Pressable>
      )}
    />
  );
}
