import React, { useCallback, useState } from "react";
import { Pressable, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListScheduledEmails,
  useCancelScheduledEmail,
  getListScheduledEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import MailListView from "@/components/MailListView";
import { useColors } from "@/hooks/useColors";

export default function ScheduledScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useListScheduledEmails();
  const cancel = useCancelScheduledEmail();

  const list = (Array.isArray(data) ? data : ((data as { emails?: unknown[] } | undefined)?.emails ?? [])) as never[];

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListScheduledEmailsQueryKey() });
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <MailListView
      title="Programmés"
      subtitle="Mails planifiés pour envoi futur"
      emails={list}
      isLoading={isLoading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      emptyIcon="clock-outline"
      emptyTitle="Aucun mail programmé"
      emptyDesc="Programme un envoi depuis l'écran de composition."
      showRecipient
      rightAction={(item) => (
        <Pressable
          onPress={() =>
            Alert.alert("Annuler l'envoi programmé ?", "Le mail ne sera pas envoyé.", [
              { text: "Garder", style: "cancel" },
              {
                text: "Annuler",
                style: "destructive",
                onPress: () => cancel.mutate({ id: item.id as number }, { onSuccess: refresh }),
              },
            ])
          }
          hitSlop={10}
        >
          <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.destructive + "AA"} />
        </Pressable>
      )}
    />
  );
}
