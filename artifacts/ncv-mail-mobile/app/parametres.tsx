import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useGetProfile,
  useUpdateProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

interface EmailConnection {
  id: string;
  provider: string;
  email_address: string;
  created_at: string;
  last_synced_at: string | null;
}

function useEmailConnections() {
  const { session } = useAuth();
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return useQuery<EmailConnection[]>({
    queryKey: ["email-connections"],
    queryFn: async () => {
      const baseUrl = domain ? `https://${domain}` : "";
      const res = await fetch(`${baseUrl}/api/email/connections`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch connections");
      return res.json();
    },
    enabled: !!session,
  });
}

const SORT_LEVELS = [
  { id: "strict", label: "Strict" },
  { id: "normal", label: "Normal" },
  { id: "souple", label: "Souple" },
];

export default function ParametresScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const { data: connections, isLoading: connectionsLoading, isError: connectionsError } = useEmailConnections();

  const [fullName, setFullName] = useState("");
  const [sortLevel, setSortLevel] = useState("normal");
  const [notifUrgent, setNotifUrgent] = useState(true);
  const [notifDaily, setNotifDaily] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
    }
  }, [profile]);

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    updateProfile.mutate(
      {
        data: {
          fullName,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setSaved(true);
          setSaving(false);
          setTimeout(() => setSaved(false), 2000);
        },
        onError: () => {
          setSaving(false);
          Alert.alert("Erreur", "Impossible de sauvegarder les modifications.");
        },
      }
    );
  };

  const providerLabel = (provider: string) => {
    switch (provider) {
      case "gmail": return "Gmail";
      case "outlook": return "Outlook";
      case "imap": return "IMAP";
      default: return provider;
    }
  };

  const providerColor = (provider: string) => {
    switch (provider) {
      case "gmail": return { bg: "#ef444415", fg: "#ef4444", letter: "G" };
      case "outlook": return { bg: "#3b82f615", fg: "#3b82f6", letter: "O" };
      default: return { bg: "#8b9cb315", fg: "#8b9cb3", letter: "@" };
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
          <Text style={[s.backText, { color: colors.mutedForeground }]}>Retour</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: isWeb ? 84 : 100 }]}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>Parametres</Text>
        <Text style={[s.pageSubtitle, { color: colors.mutedForeground }]}>
          Gerez votre profil et les preferences de l'IA.
        </Text>

        {isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: colors.primary + "15" }]}>
                  <MaterialCommunityIcons name="account-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Profil</Text>
              </View>

              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Nom complet</Text>
                <TextInput
                  style={[s.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Votre nom"
                  placeholderTextColor={colors.mutedForeground + "60"}
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Email</Text>
                <View style={[s.readOnlyField, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.readOnlyText, { color: colors.foreground + "80" }]}>
                    {profile?.email || "..."}
                  </Text>
                  <MaterialCommunityIcons name="lock-outline" size={14} color={colors.mutedForeground + "60"} />
                </View>
              </View>
            </View>

            <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: "#22c55e15" }]}>
                  <MaterialCommunityIcons name="email-check-outline" size={18} color="#22c55e" />
                </View>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Comptes email connectes</Text>
              </View>

              {connectionsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : connectionsError ? (
                <View style={s.noConnectionBox}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={28} color={colors.mutedForeground + "40"} />
                  <Text style={[s.noConnectionText, { color: colors.mutedForeground }]}>
                    Impossible de charger les comptes email
                  </Text>
                </View>
              ) : connections && connections.length > 0 ? (
                <View style={s.connectionsList}>
                  {connections.map((conn) => {
                    const pc = providerColor(conn.provider);
                    return (
                      <View
                        key={conn.id}
                        style={[s.connectionItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                      >
                        <View style={[s.connAvatar, { backgroundColor: pc.bg }]}>
                          <Text style={[s.connAvatarLetter, { color: pc.fg }]}>{pc.letter}</Text>
                        </View>
                        <View style={s.connInfo}>
                          <Text style={[s.connEmail, { color: colors.foreground }]}>{conn.email_address}</Text>
                          <View style={s.connStatusRow}>
                            <MaterialCommunityIcons name="check-circle" size={12} color="#22c55e" />
                            <Text style={[s.connStatus, { color: "#22c55e" }]}>Connecte</Text>
                            {conn.last_synced_at && (
                              <Text style={[s.connSync, { color: colors.mutedForeground }]}>
                                Sync : {new Date(conn.last_synced_at).toLocaleDateString("fr-FR")}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={[s.connBadge, { backgroundColor: pc.bg }]}>
                          <Text style={[s.connBadgeText, { color: pc.fg }]}>{providerLabel(conn.provider)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={s.noConnectionBox}>
                  <MaterialCommunityIcons name="email-off-outline" size={28} color={colors.mutedForeground + "40"} />
                  <Text style={[s.noConnectionText, { color: colors.mutedForeground }]}>
                    Aucun compte email connecte
                  </Text>
                </View>
              )}

              <View style={[s.webNotice, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
                <MaterialCommunityIcons name="monitor" size={14} color={colors.primary} />
                <Text style={[s.webNoticeText, { color: colors.mutedForeground }]}>
                  Pour ajouter ou modifier vos connexions email, rendez-vous sur l'application web NCV Mail.
                </Text>
              </View>
            </View>

            <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: "#f59e0b15" }]}>
                  <MaterialCommunityIcons name="brain" size={18} color="#f59e0b" />
                </View>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Preferences IA</Text>
              </View>

              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Niveau de tri</Text>
                <View style={s.optionRow}>
                  {SORT_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level.id}
                      style={[
                        s.optionBtn,
                        {
                          backgroundColor: sortLevel === level.id ? colors.primary + "20" : colors.background,
                          borderColor: sortLevel === level.id ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSortLevel(level.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.optionText,
                          { color: sortLevel === level.id ? colors.primary : colors.mutedForeground },
                        ]}
                      >
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.toggleGroup}>
                <View style={s.toggleRow}>
                  <View style={s.toggleInfo}>
                    <MaterialCommunityIcons name="bell-ring-outline" size={16} color={colors.mutedForeground} />
                    <Text style={[s.toggleLabel, { color: colors.foreground }]}>Alertes emails urgents</Text>
                  </View>
                  <Switch
                    value={notifUrgent}
                    onValueChange={setNotifUrgent}
                    trackColor={{ false: colors.border, true: colors.primary + "60" }}
                    thumbColor={notifUrgent ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View style={[s.toggleDivider, { backgroundColor: colors.border }]} />
                <View style={s.toggleRow}>
                  <View style={s.toggleInfo}>
                    <MaterialCommunityIcons name="calendar-check-outline" size={16} color={colors.mutedForeground} />
                    <Text style={[s.toggleLabel, { color: colors.foreground }]}>Brief quotidien</Text>
                  </View>
                  <Switch
                    value={notifDaily}
                    onValueChange={setNotifDaily}
                    trackColor={{ false: colors.border, true: colors.primary + "60" }}
                    thumbColor={notifDaily ? colors.primary : colors.mutedForeground}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                s.saveBtn,
                {
                  backgroundColor: saved ? "#22c55e" : colors.primary,
                  opacity: saving ? 0.7 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : saved ? (
                <>
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Enregistre !</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Enregistrer</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  scroll: { padding: 16, gap: 14 },
  pageTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  pageSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },

  loadingBox: { paddingVertical: 60, alignItems: "center" },

  section: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  readOnlyField: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readOnlyText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  connectionsList: { gap: 8 },
  connectionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  connAvatar: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  connAvatarLetter: { fontSize: 13, fontFamily: "Inter_700Bold" },
  connInfo: { flex: 1, minWidth: 0 },
  connEmail: { fontSize: 13, fontFamily: "Inter_500Medium" },
  connStatusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  connStatus: { fontSize: 11, fontFamily: "Inter_500Medium" },
  connSync: { fontSize: 10, fontFamily: "Inter_400Regular", marginLeft: 4 },
  connBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  connBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  noConnectionBox: { alignItems: "center", paddingVertical: 16, gap: 6 },
  noConnectionText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  webNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  webNoticeText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },

  optionRow: { flexDirection: "row", gap: 8 },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  optionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  toggleGroup: { gap: 0 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  toggleInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  toggleLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  toggleDivider: { height: 1 },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 10,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
