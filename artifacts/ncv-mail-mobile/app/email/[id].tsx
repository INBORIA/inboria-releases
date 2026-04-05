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
import { useGetEmail, useUpdateEmail } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    urgent: { bg: "#ef444420", text: "#ef4444", label: "Urgent" },
    moyen: { bg: "#f59e0b20", text: "#f59e0b", label: "Moyen" },
    faible: { bg: "#22c55e20", text: "#22c55e", label: "Faible" },
  };
  const c = config[priority] || config.faible;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data: email, isLoading } = useGetEmail(Number(id));
  const updateEmail = useUpdateEmail();

  const handleMarkRead = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateEmail.mutate(
      { id: Number(id), data: { status: "read" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listEmails"] }) }
    );
  };

  const handleArchive = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateEmail.mutate(
      { id: Number(id), data: { status: "archived" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listEmails"] });
          router.back();
        },
      }
    );
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!email) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={48} color={colors.mutedForeground + "40"} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Email introuvable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: isWeb ? 34 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.emailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.subjectRow}>
            <Text style={[styles.subject, { color: colors.foreground }]}>{email.subject}</Text>
            <PriorityBadge priority={email.priority ?? "faible"} />
          </View>

          <View style={styles.senderRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + "25" }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(email.sender || "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.senderInfo}>
              <Text style={[styles.senderName, { color: colors.foreground }]}>{email.sender}</Text>
              {email.senderEmail ? (
                <Text style={[styles.senderEmail, { color: colors.mutedForeground }]}>
                  {email.senderEmail}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {formatFullDate(email.createdAt)}
            </Text>
          </View>
        </View>

        {email.summary ? (
          <View style={[styles.summaryCard, { backgroundColor: colors.primary + "0A", borderColor: colors.primary + "20" }]}>
            <View style={styles.summaryHeader}>
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.primary }]}>Resume IA</Text>
            </View>
            <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>{email.summary}</Text>
          </View>
        ) : null}

        {email.categoryName ? (
          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="tag" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{email.categoryName}</Text>
            </View>
            {email.projectReference ? (
              <View style={[styles.metaChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
                <Feather name="folder" size={12} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.primary }]}>{email.projectReference}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.bodyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.bodyText, { color: colors.foreground + "CC" }]}>
            {email.body || "(Aucun contenu disponible)"}
          </Text>
        </View>

        <View style={styles.actionRow}>
          {email.status === "unread" && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleMarkRead}
              activeOpacity={0.7}
            >
              <Feather name="check" size={18} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>Marquer lu</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleArchive}
            activeOpacity={0.7}
          >
            <Feather name="archive" size={18} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Archiver</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 12 },
  scrollContent: { padding: 16 },
  emailCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  subjectRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  subject: { fontSize: 18, fontFamily: "Inter_700Bold", flex: 1, lineHeight: 24 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderInfo: { flex: 1 },
  senderName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  bodyCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
