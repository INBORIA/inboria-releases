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
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Barre de priorité à gauche — mêmes couleurs que la version web
// (urgent → rouge, moyen → ambre, faible → discret/transparent).
function priorityBarColor(
  priority: string | null,
  colors: ReturnType<typeof useColors>,
): string {
  switch ((priority || "").toLowerCase()) {
    case "urgent":
      return colors.destructive;
    case "moyen":
      return colors.warning;
    default:
      return "transparent";
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
  const barColor = priorityBarColor(email.priority, colors);

  const senderColor = isUnread ? colors.foreground : colors.mailRead;
  const senderFont = isUnread ? "Inter_600SemiBold" : "Inter_400Regular";
  const subjectColor = isUnread ? colors.foreground : colors.mailRead;
  const subjectFont = isUnread ? "Inter_500Medium" : "Inter_400Regular";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.mailBorder,
          backgroundColor: pressed ? colors.surfaceHover : "transparent",
        },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: barColor }]} />
      <Avatar name={email.sender} email={email.senderEmail} size={36} />

      <View style={styles.body}>
        <View style={styles.line}>
          <Text numberOfLines={1} style={[styles.sender, { color: senderColor, fontFamily: senderFont }]}>
            {email.sender || email.senderEmail || "Inconnu"}
          </Text>
          <Text style={[styles.date, { color: colors.mailMuted }]}>
            {formatDate(email.createdAt)}
          </Text>
        </View>

        <View style={styles.line}>
          <Text numberOfLines={1} style={[styles.subject, { color: subjectColor, fontFamily: subjectFont }]}>
            {email.subject || "(sans objet)"}
          </Text>
          {email.attachmentCount > 0 ? (
            <Feather name="paperclip" size={12} color={colors.mailMuted} style={styles.clip} />
          ) : null}
          {email.categoryName ? (
            <Text numberOfLines={1} style={[styles.category, { color: colors.mailMeta }]}>
              {email.categoryName.toLowerCase()}
            </Text>
          ) : null}
        </View>

        {email.summary ? (
          <Text numberOfLines={1} style={[styles.summary, { color: colors.mailSummary }]}>
            {email.summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  body: { flex: 1, gap: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  sender: { flex: 1, fontSize: 14 },
  date: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
  subject: { flex: 1, fontSize: 13.5 },
  clip: { marginLeft: 2 },
  category: { fontSize: 11, fontFamily: "Inter_400Regular", maxWidth: 110 },
  summary: { fontSize: 12.5, fontFamily: "Inter_400Regular" },
});
