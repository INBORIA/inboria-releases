import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useGetProfile } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { data: profile } = useGetProfile();
  const isWeb = Platform.OS === "web";

  const planLabels: Record<string, string> = {
    free: "Gratuit",
    pro: "Pro",
    business: "Business",
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: isWeb ? 75 : 8, paddingBottom: isWeb ? 84 : 90 }]}
    >
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "25" }]}>
          <Feather name="user" size={24} color={colors.primary} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {profile?.fullName || "..."}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
            {profile?.email || "..."}
          </Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Abonnement</Text>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>Plan</Text>
          <View style={[styles.planBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.planText, { color: colors.primary }]}>
              {planLabels[profile?.plan || "free"] || profile?.plan}
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>Emails utilises</Text>
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
            {profile?.emailsUsed ?? 0} / {profile?.emailsQuota ?? 0}
          </Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Preferences</Text>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>Langue IA</Text>
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
            {profile?.aiLanguage === "en" ? "Anglais" : profile?.aiLanguage === "nl" ? "Neerlandais" : "Francais"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}
        onPress={signOut}
        activeOpacity={0.7}
        testID="logout-button"
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Se deconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 14, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginVertical: 10 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  planText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
