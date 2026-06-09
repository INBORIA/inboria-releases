import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import type { EmailListItem } from "@/lib/api";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function priorityColor(
  priority: string | null,
  colors: ReturnType<typeof useColors>,
): string | null {
  switch ((priority || "").toLowerCase()) {
    case "urgente":
      return colors.destructive;
    case "haute":
      return colors.warning;
    case "moyenne":
      return colors.accent;
    default:
      return null;
  }
}

export function EmailRow({
  email,
  onPress,
}: {
  email: EmailListItem;
  onPress: () => void;
}) {
  const colors = useColors();
  const isUnread = (email.status || "").toLowerCase() !== "read";
  const pColor = priorityColor(email.priority, colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.surfaceHover : "transparent",
        },
      ]}
    >
      <View
        style={[
          styles.priorityBar,
          { backgroundColor: pColor ?? "transparent" },
        ]}
      />
      <Avatar name={email.sender} email={email.senderEmail} size={42} />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.sender,
              {
                color: isUnread ? colors.foreground : colors.mutedForeground,
                fontFamily: isUnread ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}
          >
            {email.sender || email.senderEmail || "Inconnu"}
          </Text>
          <Text style={[styles.date, { color: colors.faint }]}>
            {formatDate(email.createdAt)}
          </Text>
        </View>

        <View style={styles.subjectLine}>
          {isUnread ? (
            <View style={[styles.dot, { backgroundColor: colors.unread }]} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.subject,
              {
                color: isUnread ? colors.foreground : colors.mutedForeground,
                fontFamily: isUnread ? "Inter_500Medium" : "Inter_400Regular",
              },
            ]}
          >
            {email.subject || "(sans objet)"}
          </Text>
        </View>

        {email.summary ? (
          <View style={styles.summaryLine}>
            <Feather name="zap" size={11} color={colors.accent} />
            <Text
              numberOfLines={1}
              style={[styles.summary, { color: colors.mutedForeground }]}
            >
              {email.summary}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 8,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  priorityBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
  },
  body: { flex: 1, gap: 3 },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sender: { flex: 1, fontSize: 15 },
  date: { fontSize: 12, fontFamily: "Inter_400Regular" },
  subjectLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  subject: { flex: 1, fontSize: 14 },
  summaryLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  summary: { flex: 1, fontSize: 12.5, fontFamily: "Inter_400Regular" },
});
