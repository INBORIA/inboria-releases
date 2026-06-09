import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { listFollowups } from "@/lib/api";
import { formatDate } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  repondu: "Répondu",
  relance_envoyee: "Relance envoyée",
};

export default function RelancesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["followups"], queryFn: listFollowups });
  const items = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Relances" />
      {query.isLoading ? (
        <SkeletonList />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : items.length === 0 ? (
        <CenterState
          icon="bell"
          title="Aucune relance"
          subtitle="Inboria suggère des relances pour les e-mails restés sans réponse."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View
              style={[styles.row, { borderBottomColor: colors.mailBorder }]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.avatarBg,
                    borderColor: colors.avatarBorder,
                  },
                ]}
              >
                <Feather name="bell" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: colors.foreground }]}
                >
                  {item.emailSubject ?? "(sans objet)"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.sub, { color: colors.mailMuted }]}
                >
                  {item.emailSender ?? "—"}
                </Text>
                <View style={styles.metaRow}>
                  {item.status ? (
                    <Text style={[styles.badge, { color: colors.mailMeta }]}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Text>
                  ) : null}
                  {item.aiSuggestion ? (
                    <Text style={[styles.aiBadge, { color: colors.primary }]}>
                      Suggestion IA
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.date, { color: colors.mailMuted }]}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  badge: { fontSize: 11.5, fontFamily: "Inter_500Medium" },
  aiBadge: { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },
  date: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
