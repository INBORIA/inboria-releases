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

// Ligne mail FIDÈLE à la maquette web « Réception sombre » (SuperhumanDark) :
// pastille non-lu, avatar initiales, expéditeur + heure, puis sujet + « — extrait »
// sur la MÊME ligne (sujet en gras si non-lu, extrait en gris), catégorie en
// minuscule + trombone. Aucune barre de priorité, aucune 3e ligne de résumé.
export function EmailRow({
  email,
  onPress,
  showRecipient = false,
}: {
  email: EmailListItem;
  onPress: () => void;
  showRecipient?: boolean;
}) {
  const colors = useColors();
  const isUnread = (email.status || "").toLowerCase() !== "read";

  // En boîte « Envoyés », on affiche le DESTINATAIRE (pas l'expéditeur, qui est
  // le compte de l'utilisateur). Le backend renvoie recipient pour ces e-mails.
  const displayName = showRecipient
    ? email.recipient || "Inconnu"
    : email.sender || email.senderEmail || "Inconnu";
  const avatarName = showRecipient ? email.recipient || "" : email.sender;
  const avatarEmail = showRecipient ? email.recipient || "" : email.senderEmail;

  const nameColor = isUnread ? colors.foreground : colors.mailRead;
  const nameFont = isUnread ? "Inter_600SemiBold" : "Inter_400Regular";
  const subjectColor = isUnread ? colors.foreground : colors.mailRead;
  const subjectFont = isUnread ? "Inter_600SemiBold" : "Inter_400Regular";

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
      {/* Pastille non-lu (comme la maquette) */}
      <View style={styles.dotCol}>
        {isUnread ? (
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        ) : null}
      </View>

      <Avatar name={avatarName} email={avatarEmail} size={28} />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text
            numberOfLines={1}
            style={[styles.sender, { color: nameColor, fontFamily: nameFont }]}
          >
            {displayName}
          </Text>
          <Text style={[styles.date, { color: colors.mailMuted }]}>
            {formatDate(email.createdAt)}
          </Text>
        </View>

        <View style={styles.bottomLine}>
          <Text numberOfLines={1} style={styles.subjectWrap}>
            <Text style={{ color: subjectColor, fontFamily: subjectFont }}>
              {email.subject || "(sans objet)"}
            </Text>
            {email.summary ? (
              <Text style={{ color: colors.mailSummary, fontFamily: "Inter_400Regular" }}>
                {"  — "}
                {email.summary}
              </Text>
            ) : null}
          </Text>
          {email.attachmentCount > 0 ? (
            <Feather
              name="paperclip"
              size={12}
              color={colors.mailMuted}
              style={styles.clip}
            />
          ) : null}
          {email.categoryName ? (
            <Text
              numberOfLines={1}
              style={[styles.category, { color: colors.mailMeta }]}
            >
              {email.categoryName.toLowerCase()}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingLeft: 6,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dotCol: { width: 8, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  body: { flex: 1, gap: 2 },
  topLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  sender: { flex: 1, fontSize: 13.5 },
  date: { fontSize: 11.5, fontFamily: "Inter_400Regular", fontVariant: ["tabular-nums"] },
  bottomLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectWrap: { flex: 1, fontSize: 13 },
  clip: { marginLeft: 2 },
  category: { fontSize: 11, fontFamily: "Inter_400Regular", maxWidth: 100 },
});
