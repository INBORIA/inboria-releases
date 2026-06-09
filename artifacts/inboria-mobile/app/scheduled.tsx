import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { cancelScheduled, listScheduled, type ScheduledEmail } from "@/lib/api";

function fmt(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScheduledScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["emails", "scheduled"],
    queryFn: listScheduled,
  });
  const cancel = useMutation({
    mutationFn: (id: number) => cancelScheduled(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails", "scheduled"] }),
  });
  const rows = query.data ?? [];

  function confirmCancel(item: ScheduledEmail) {
    if (Platform.OS === "web") {
      cancel.mutate(item.id);
      return;
    }
    Alert.alert("Annuler l'envoi", "Annuler cet envoi programmé ?", [
      { text: "Non", style: "cancel" },
      {
        text: "Oui",
        style: "destructive",
        onPress: () => cancel.mutate(item.id),
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Programmés" />
      {query.isLoading ? (
        <SkeletonList />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : rows.length === 0 ? (
        <CenterState
          icon="clock"
          title="Aucun envoi programmé"
          subtitle="Les e-mails planifiés apparaîtront ici."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 6 }}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: colors.mailBorder }]}>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.subject, { color: colors.foreground }]}
                >
                  {item.subject || "(sans objet)"}
                </Text>
                <View style={styles.meta}>
                  <Feather name="clock" size={12} color={colors.primary} />
                  <Text style={[styles.when, { color: colors.mailMuted }]}>
                    {fmt(item.scheduledSendAt)}
                    {item.to ? ` · ${item.to}` : ""}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => confirmCancel(item)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  {
                    backgroundColor: pressed
                      ? colors.surfaceHover
                      : "transparent",
                  },
                ]}
              >
                <Feather name="x" size={18} color={colors.destructive} />
              </Pressable>
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
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subject: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  when: { fontSize: 12.5, fontFamily: "Inter_400Regular" },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
