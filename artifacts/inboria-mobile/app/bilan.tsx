import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, FullLoader } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { getDashboardSummary } from "@/lib/api";

export default function BilanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });
  const s = query.data;

  const stats: { icon: keyof typeof Feather.glyphMap; label: string; value: number; tint: string }[] =
    s
      ? [
          { icon: "inbox", label: "E-mails au total", value: s.totalEmails, tint: colors.primary },
          { icon: "alert-circle", label: "Urgents", value: s.urgentCount, tint: colors.destructive },
          { icon: "arrow-up-circle", label: "Priorité moyenne", value: s.moyenCount, tint: colors.warning },
          { icon: "minus-circle", label: "Priorité faible", value: s.faibleCount, tint: colors.mailMuted },
          { icon: "help-circle", label: "Non classés", value: s.uncategorizedCount, tint: colors.accent },
          { icon: "check-square", label: "Tâches en attente", value: s.pendingTasks, tint: colors.success },
        ]
      : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Bilan quotidien" />
      {query.isLoading ? (
        <FullLoader />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 14,
            paddingBottom: insets.bottom + 32,
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.grid}>
            {stats.map((st) => (
              <View
                key={st.label}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name={st.icon} size={20} color={st.tint} />
                <Text style={[styles.value, { color: colors.foreground }]}>
                  {st.value}
                </Text>
                <Text style={[styles.label, { color: colors.mailMuted }]}>
                  {st.label}
                </Text>
              </View>
            ))}
          </View>

          {s ? (
            <View
              style={[
                styles.quota,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.quotaTitle, { color: colors.foreground }]}>
                Quota d'e-mails — formule {s.plan}
              </Text>
              <Text style={[styles.quotaText, { color: colors.mailMuted }]}>
                {s.emailsUsed} / {s.emailsQuota} e-mails utilisés
              </Text>
              <View
                style={[styles.barBg, { backgroundColor: colors.surfaceHover }]}
              >
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.min(
                        100,
                        s.emailsQuota > 0
                          ? (s.emailsUsed / s.emailsQuota) * 100
                          : 0,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  value: { fontSize: 26, fontFamily: "Inter_700Bold" },
  label: { fontSize: 12.5, fontFamily: "Inter_400Regular" },
  quota: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  quotaTitle: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  quotaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  barBg: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  barFill: { height: 8, borderRadius: 4 },
});
