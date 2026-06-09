import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, FullLoader } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { getProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const PLAN_LABELS: Record<string, string> = {
  essai: "Essai",
  solo: "Solo",
  pro: "Pro",
  business: "Business",
};

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const query = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const p = query.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Paramètres" />
      {query.isLoading ? (
        <FullLoader />
      ) : query.isError || !p ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.name, { color: colors.foreground }]}>
              {p.fullName || "—"}
            </Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]}>
              {p.email}
            </Text>
            <View
              style={[
                styles.planBadge,
                {
                  backgroundColor: colors.chipActiveBg,
                  borderColor: colors.chipActiveBorder,
                },
              ]}
            >
              <Feather name="zap" size={12} color={colors.primary} />
              <Text style={[styles.planText, { color: colors.primary }]}>
                Plan {PLAN_LABELS[p.plan] || p.plan}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Row
              icon="globe"
              label="Langue IA"
              value={(p.aiLanguage || "fr").toUpperCase()}
            />
            <Row icon="clock" label="Fuseau horaire" value={p.timezone} last />
          </View>

          <Text style={[styles.note, { color: colors.faint }]}>
            La configuration avancée (connexions, règles, équipe…) se fait depuis
            l'app web Inboria.
          </Text>

          <Pressable
            onPress={() => signOut()}
            style={({ pressed }) => [
              styles.signOut,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceHover : colors.card,
              },
            ]}
          >
            <Feather name="log-out" size={17} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>
              Déconnexion
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !last && {
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  name: { fontSize: 18, fontFamily: "Inter_700Bold" },
  email: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 3 },
  planBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  planText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13 },
  rowLabel: { flex: 1, fontSize: 14.5, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 14.5, fontFamily: "Inter_500Medium" },
  note: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
