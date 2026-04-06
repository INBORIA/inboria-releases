import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGetProfile } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  pro: "Pro",
  business: "Business",
};

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { data: profile } = useGetProfile();
  const isWeb = Platform.OS === "web";

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: isWeb ? 75 : 8, paddingBottom: isWeb ? 84 : 100 }]}
    >
      <View style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
          <MaterialCommunityIcons name="account-outline" size={24} color={colors.primary} />
        </View>
        <View style={s.profileInfo}>
          <Text style={[s.profileName, { color: colors.foreground }]}>
            {profile?.fullName || "..."}
          </Text>
          <Text style={[s.profileEmail, { color: colors.mutedForeground }]}>
            {profile?.email || "..."}
          </Text>
        </View>
      </View>

      <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>Abonnement</Text>
        <View style={s.row}>
          <Text style={[s.rowLabel, { color: colors.foreground }]}>Plan</Text>
          <View style={[s.planBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[s.planText, { color: colors.primary }]}>
              {PLAN_LABELS[profile?.plan || "free"] || profile?.plan}
            </Text>
          </View>
        </View>
        <View style={[s.divider, { backgroundColor: colors.border }]} />
        <View style={s.row}>
          <Text style={[s.rowLabel, { color: colors.foreground }]}>Emails utilises</Text>
          <Text style={[s.rowValue, { color: colors.mutedForeground }]}>
            {profile?.emailsUsed ?? 0} / {profile?.emailsQuota ?? 0}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[s.logoutBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}
        onPress={signOut}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="logout" size={18} color={colors.destructive} />
        <Text style={[s.logoutLabel, { color: colors.destructive }]}>Se deconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },

  section: { borderRadius: 12, borderWidth: 1, padding: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 14, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginVertical: 10 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  planText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
