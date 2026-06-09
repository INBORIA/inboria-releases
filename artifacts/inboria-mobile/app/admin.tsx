import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, FullLoader } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { getTeamDashboard } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({
    queryKey: ["team-dashboard"],
    queryFn: getTeamDashboard,
  });
  const data = query.data;
  const members = data?.members ?? [];
  const activity = data?.recentActivity ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Admin" />
      {query.isLoading ? (
        <FullLoader />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : members.length === 0 && activity.length === 0 ? (
        <CenterState
          icon="shield"
          title="Aucune donnée d'équipe"
          subtitle="Les statistiques d'équipe s'affichent ici dès qu'une organisation est active."
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
          <Text style={[styles.section, { color: colors.mailMuted }]}>
            ÉQUIPE
          </Text>
          {members.map((m) => (
            <View
              key={m.userId}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Avatar name={m.fullName} email={m.fullName} size={38} />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: colors.foreground }]}
                >
                  {m.fullName}
                </Text>
                {m.role ? (
                  <Text style={[styles.role, { color: colors.mailMeta }]}>
                    {m.role}
                  </Text>
                ) : null}
              </View>
              <View style={styles.kpis}>
                <Text style={[styles.kpi, { color: colors.foreground }]}>
                  {m.assignedEmails}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.mailMuted }]}>
                  assignés
                </Text>
              </View>
              <View style={styles.kpis}>
                <Text style={[styles.kpi, { color: colors.foreground }]}>
                  {m.commentsCount}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.mailMuted }]}>
                  comm.
                </Text>
              </View>
            </View>
          ))}

          {activity.length > 0 ? (
            <>
              <Text
                style={[
                  styles.section,
                  { color: colors.mailMuted, marginTop: 18 },
                ]}
              >
                ACTIVITÉ RÉCENTE
              </Text>
              {activity.map((a) => (
                <View
                  key={a.id}
                  style={[styles.actRow, { borderBottomColor: colors.mailBorder }]}
                >
                  <Feather
                    name="activity"
                    size={15}
                    color={colors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.actText, { color: colors.foreground }]}
                    >
                      {a.userName} · {a.action ?? "—"}
                    </Text>
                    <Text style={[styles.actMeta, { color: colors.mailMuted }]}>
                      {formatDateTime(a.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  name: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  role: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  kpis: { alignItems: "center", minWidth: 50 },
  kpi: { fontSize: 16, fontFamily: "Inter_700Bold" },
  kpiLabel: { fontSize: 10.5, fontFamily: "Inter_400Regular", marginTop: 1 },
  actRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actText: { fontSize: 13.5, fontFamily: "Inter_500Medium" },
  actMeta: { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 2 },
});
