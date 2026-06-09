import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { listAppointments } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function AgendaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });
  const items = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Agenda" />
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
          icon="calendar"
          title="Aucun rendez-vous"
          subtitle="Vos rendez-vous et propositions de créneaux apparaîtront ici."
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
                <Feather name="calendar" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: colors.foreground }]}
                >
                  {item.title ?? "(sans titre)"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.sub, { color: colors.mailMuted }]}
                >
                  {item.allDay
                    ? "Toute la journée"
                    : formatDateTime(item.startAt)}
                </Text>
                {item.location ? (
                  <View style={styles.metaRow}>
                    <Feather
                      name="map-pin"
                      size={12}
                      color={colors.mailMeta}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.loc, { color: colors.mailMeta }]}
                    >
                      {item.location}
                    </Text>
                  </View>
                ) : null}
              </View>
              {item.status && item.status !== "confirmed" ? (
                <Text style={[styles.status, { color: colors.warning }]}>
                  {item.status === "pending" ? "En attente" : item.status}
                </Text>
              ) : null}
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  loc: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  status: { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },
});
