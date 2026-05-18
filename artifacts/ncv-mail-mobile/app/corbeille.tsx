import React, { useCallback, useState } from "react";
import { Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import {
  useListEmails,
  useDeleteEmail,
  useEmptyTrash,
  useUpdateEmail,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import MailListView from "@/components/MailListView";
import { useColors } from "@/hooks/useColors";

export default function TrashScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useListEmails({ status: "trashed", limit: 100 });
  const emails = (data as { emails?: unknown[] } | undefined)?.emails as never[] | undefined;
  const deleteEmail = useDeleteEmail();
  const updateEmail = useUpdateEmail();
  const emptyTrash = useEmptyTrash();

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleEmpty = () => {
    Alert.alert("Vider la corbeille ?", "Tous les mails de la corbeille seront définitivement supprimés.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Tout vider",
        style: "destructive",
        onPress: () => emptyTrash.mutate(undefined, { onSuccess: refresh }),
      },
    ]);
  };

  return (
    <MailListView
      title="Corbeille"
      subtitle={(emails?.length ?? 0) > 0 ? "Touche l'icône balai à droite pour tout vider" : undefined}
      emails={emails}
      isLoading={isLoading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      emptyIcon="trash-can-outline"
      emptyTitle="Corbeille vide"
      emptyDesc="Aucun mail supprimé pour le moment."
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
            <Pressable
              onPress={() =>
                Alert.alert("Supprimer définitivement ?", "Le mail sera effacé.", [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: () => deleteEmail.mutate({ id }, { onSuccess: refresh }),
                  },
                ])
              }
              hitSlop={10}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.destructive + "AA"} />
            </Pressable>
            {(emails?.length ?? 0) > 0 ? (
              <Pressable onPress={handleEmpty} hitSlop={10}>
                <MaterialCommunityIcons name="delete-sweep-outline" size={18} color={colors.destructive} />
              </Pressable>
            ) : null}
          </>
        );
      }}
    />
  );
}
