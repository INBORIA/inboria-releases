import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Platform, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmailRow } from "@/components/EmailRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { type EmailListItem, type EmailListResponse } from "@/lib/api";

export function EmailListScreen({
  title,
  queryKey,
  queryFn,
  emptyIcon = "inbox",
  emptyTitle = "Aucun e-mail",
  emptySubtitle,
  showRecipient = false,
}: {
  title: string;
  queryKey: unknown[];
  queryFn: () => Promise<EmailListResponse>;
  emptyIcon?: keyof typeof Feather.glyphMap;
  emptyTitle?: string;
  emptySubtitle?: string;
  showRecipient?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const query = useQuery({ queryKey, queryFn });
  const emails = query.data?.emails ?? [];

  function open(email: EmailListItem) {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: "/email/[id]", params: { id: String(email.id) } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={title} />
      {query.isLoading ? (
        <SkeletonList />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          subtitle="Impossible de charger les e-mails. Vérifiez votre connexion."
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : emails.length === 0 ? (
        <CenterState
          icon={emptyIcon}
          title={emptyTitle}
          subtitle={emptySubtitle}
        />
      ) : (
        <FlatList
          data={emails}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <EmailRow email={item} onPress={() => open(item)} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}
