import React, { useCallback, useState } from "react";
import { Alert, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListEmails,
  useUpdateEmail,
  useEmptySpam,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import MailListView from "@/components/MailListView";
import { useColors } from "@/hooks/useColors";

export default function SpamScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useListEmails({ status: "spam", limit: 100 });
  const emails = (data as { emails?: unknown[] } | undefined)?.emails as never[] | undefined;
  const updateEmail = useUpdateEmail();
  const emptySpam = useEmptySpam();

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
      title="Indésirables"
      subtitle="Mails marqués comme spam"
      emails={emails}
      isLoading={isLoading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      emptyIcon="alert-octagon-outline"
      emptyTitle="Aucun indésirable"
      emptyDesc="Inboria filtre les spams automatiquement."
      rightAction={(item) => {
        const id = item.id as number;
        return (
          <>
            <Pressable
              onPress={() =>
                updateEmail.mutate(
                  { id, data: { status: "non_lu" } },
                  { onSuccess: refresh }
                )
              }
              hitSlop={10}
            >
              <MaterialCommunityIcons name="inbox-arrow-down" size={18} color={colors.primary} />
            </Pressable>
            {(emails?.length ?? 0) > 0 ? (
              <Pressable
                onPress={() =>
                  Alert.alert("Vider les indésirables ?", "Tous les spams seront supprimés.", [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Tout vider",
                      style: "destructive",
                      onPress: () => emptySpam.mutate(undefined, { onSuccess: refresh }),
                    },
                  ])
                }
                hitSlop={10}
              >
                <MaterialCommunityIcons name="delete-sweep-outline" size={18} color={colors.destructive} />
              </Pressable>
            ) : null}
          </>
        );
      }}
    />
  );
}
