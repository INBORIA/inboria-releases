import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type MailEntry = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: string;
  count?: number;
  group: "mail" | "team" | "work" | "system";
};

export default function MenuScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { data: summary } = useGetDashboardSummary();

  const totalInbox =
    (summary?.urgentCount ?? 0) + (summary?.moyenCount ?? 0) + (summary?.faibleCount ?? 0);

  const entries: MailEntry[] = [
    { key: "inbox", label: "Réception", icon: "inbox", route: "/(tabs)", count: totalInbox, group: "mail" },
    { key: "spam", label: "Indésirables", icon: "alert-octagon-outline", route: "/indesirables", group: "mail" },
    { key: "trash", label: "Corbeille", icon: "trash-can-outline", route: "/corbeille", group: "mail" },
    { key: "sent", label: "Envoyés", icon: "send-outline", route: "/envoyes", group: "mail" },
    { key: "scheduled", label: "Programmés", icon: "clock-outline", route: "/programmes", group: "mail" },
    { key: "snoozed", label: "Reportés", icon: "alarm-snooze", route: "/reportes", group: "mail" },
    { key: "archives", label: "Archives", icon: "archive-outline", route: "/archives", group: "mail" },

    { key: "shared", label: "Partagées", icon: "account-multiple-outline", route: "/partagees", group: "team" },
    { key: "assigned", label: "Assignés", icon: "account-arrow-right-outline", route: "/assignes", group: "team" },

    { key: "tasks", label: "Tâches", icon: "check-circle-outline", route: "/(tabs)/tasks", group: "work" },
    { key: "projects", label: "Projets", icon: "folder-outline", route: "/(tabs)/projects", group: "work" },
    { key: "followups", label: "Relances", icon: "rotate-right", route: "/relances", group: "work" },
    { key: "folders", label: "Mes dossiers", icon: "folder-multiple-outline", route: "/dossiers", group: "work" },
    { key: "categories", label: "Catégories", icon: "tag-multiple-outline", route: "/categories", group: "work" },
    { key: "agenda", label: "Agenda", icon: "calendar-month-outline", route: "/(tabs)/agenda", group: "work" },
    { key: "bilan", label: "Bilan", icon: "chart-bar", route: "/(tabs)/bilan", group: "work" },

    { key: "settings", label: "Réglages", icon: "cog-outline", route: "/parametres", group: "system" },
    { key: "subscription", label: "Abonnement", icon: "credit-card-outline", route: "/abonnement", group: "system" },
  ];

  const groups: { key: MailEntry["group"]; label: string }[] = [
    { key: "mail", label: "Boîtes mail" },
    { key: "team", label: "Équipe" },
    { key: "work", label: "Travail" },
    { key: "system", label: "Compte" },
  ];

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <MaterialCommunityIcons name="close" size={22} color={colors.mutedForeground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Toutes les boîtes</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((g) => {
          const items = entries.filter((e) => e.group === g.key);
          return (
            <View key={g.key} style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>{g.label}</Text>
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {items.map((it, idx) => (
                  <Pressable
                    key={it.key}
                    style={({ pressed }) => [
                      s.row,
                      idx < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                      pressed && { backgroundColor: colors.foreground + "08" },
                    ]}
                    onPress={() => {
                      router.back();
                      setTimeout(() => router.push(it.route as never), 50);
                    }}
                  >
                    <View style={[s.rowIcon, { backgroundColor: colors.primary + "15" }]}>
                      <MaterialCommunityIcons name={it.icon} size={18} color={colors.primary} />
                    </View>
                    <Text style={[s.rowLabel, { color: colors.foreground }]}>{it.label}</Text>
                    {typeof it.count === "number" && it.count > 0 ? (
                      <View style={[s.badge, { backgroundColor: colors.primary + "18" }]}>
                        <Text style={[s.badgeText, { color: colors.primary }]}>{it.count}</Text>
                      </View>
                    ) : null}
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground + "70"} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },

  scroll: { padding: 16, gap: 20 },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
