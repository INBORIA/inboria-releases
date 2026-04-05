import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetEmail, useUpdateEmail, getListEmailsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

let Haptics: typeof import("expo-haptics") | null = null;
try {
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

const PRIORITY_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  urgent: { bg: "#ef444420", fg: "#ef4444", label: "Urgent" },
  moyen: { bg: "#f59e0b20", fg: "#f59e0b", label: "Moyen" },
  faible: { bg: "#22c55e20", fg: "#22c55e", label: "Faible" },
};

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data: email, isLoading } = useGetEmail(Number(id));
  const updateEmail = useUpdateEmail();

  const hapticFeedback = () => {
    if (Platform.OS !== "web" && Haptics) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  const handleMarkRead = () => {
    hapticFeedback();
    updateEmail.mutate(
      { id: Number(id), data: { status: "read" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() }) }
    );
  };

  const handleArchive = () => {
    hapticFeedback();
    updateEmail.mutate(
      { id: Number(id), data: { status: "archived" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          router.back();
        },
      }
    );
  };

  const formatFullDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isLoading) {
    return (
      <View style={[s.full, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!email) {
    return (
      <View style={[s.full, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={48} color={colors.mutedForeground + "40"} />
        <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>Email introuvable</Text>
      </View>
    );
  }

  const pConfig = PRIORITY_CONFIG[email.priority ?? "faible"] || PRIORITY_CONFIG.faible;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: isWeb ? 34 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.subjectRow}>
            <Text style={[s.subjectText, { color: colors.foreground }]}>{email.subject}</Text>
            <View style={[s.priorityBadge, { backgroundColor: pConfig.bg }]}>
              <Text style={[s.priorityLabel, { color: pConfig.fg }]}>{pConfig.label}</Text>
            </View>
          </View>

          <View style={s.senderRow}>
            <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>
                {(email.sender || "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={s.senderInfo}>
              <Text style={[s.senderName, { color: colors.foreground }]}>{email.sender}</Text>
              {email.senderEmail ? (
                <Text style={[s.senderEmail, { color: colors.mutedForeground }]}>
                  {email.senderEmail}
                </Text>
              ) : null}
            </View>
            <Text style={[s.dateText, { color: colors.mutedForeground }]}>
              {formatFullDate(email.createdAt)}
            </Text>
          </View>
        </View>

        {email.summary ? (
          <View
            style={[
              s.summaryCard,
              { backgroundColor: colors.primary + "0A", borderColor: colors.primary + "20" },
            ]}
          >
            <View style={s.summaryHeader}>
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[s.summaryTitle, { color: colors.primary }]}>Resume IA</Text>
            </View>
            <Text style={[s.summaryBody, { color: colors.mutedForeground }]}>
              {email.summary}
            </Text>
          </View>
        ) : null}

        {(email.categoryName || email.projectReference) ? (
          <View style={s.chipRow}>
            {email.categoryName ? (
              <View style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="tag" size={12} color={colors.mutedForeground} />
                <Text style={[s.chipText, { color: colors.mutedForeground }]}>
                  {email.categoryName}
                </Text>
              </View>
            ) : null}
            {email.projectReference ? (
              <View
                style={[s.chip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
              >
                <Feather name="folder" size={12} color={colors.primary} />
                <Text style={[s.chipText, { color: colors.primary }]}>
                  {email.projectReference}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[s.bodyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.bodyText, { color: colors.foreground + "CC" }]}>
            {email.body || "(Aucun contenu disponible)"}
          </Text>
        </View>

        <View style={s.actionsRow}>
          {email.status === "unread" && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleMarkRead}
              activeOpacity={0.7}
            >
              <Feather name="check" size={18} color={colors.primary} />
              <Text style={[s.actionLabel, { color: colors.primary }]}>Marquer lu</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleArchive}
            activeOpacity={0.7}
          >
            <Feather name="archive" size={18} color={colors.mutedForeground} />
            <Text style={[s.actionLabel, { color: colors.mutedForeground }]}>Archiver</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  full: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyLabel: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 12 },

  scroll: { padding: 16 },

  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },

  subjectRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  subjectText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    flex: 1,
    lineHeight: 24,
  },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  priorityLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  senderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderInfo: { flex: 1, minWidth: 0 },
  senderName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },

  summaryCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  summaryTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  bodyCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
