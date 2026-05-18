import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type AnyEmail = {
  id: number | string;
  sender?: string | null;
  recipient?: string | null;
  subject?: string | null;
  summary?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  priority?: string | null;
  status?: string | null;
  categoryName?: string | null;
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export type MailListViewProps = {
  title: string;
  subtitle?: string;
  emails: AnyEmail[] | undefined;
  isLoading: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  emptyTitle?: string;
  emptyDesc?: string;
  showRecipient?: boolean;
  rightAction?: (email: AnyEmail) => React.ReactNode;
  onPressEmail?: (email: AnyEmail) => void;
};

export default function MailListView({
  title,
  subtitle,
  emails,
  isLoading,
  refreshing,
  onRefresh,
  emptyIcon = "email-open-outline",
  emptyTitle,
  emptyDesc,
  showRecipient,
  rightAction,
  onPressEmail,
}: MailListViewProps) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const list = emails ?? [];

  const handlePress = (e: AnyEmail) => {
    if (onPressEmail) return onPressEmail(e);
    router.push(`/email/${e.id}`);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.pageTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[s.pageSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Text style={[s.headerCount, { color: colors.mutedForeground }]}>
          {list.length}
        </Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={s.emptyBox}>
          <MaterialCommunityIcons name={emptyIcon} size={48} color={colors.mutedForeground + "30"} />
          {emptyTitle ? <Text style={[s.emptyTitle, { color: colors.foreground }]}>{emptyTitle}</Text> : null}
          {emptyDesc ? <Text style={[s.emptyText, { color: colors.mutedForeground }]}>{emptyDesc}</Text> : null}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            ) : undefined
          }
          renderItem={({ item }) => {
            const who = showRecipient ? item.recipient || item.sender || "?" : item.sender || item.recipient || "?";
            const dateStr = item.createdAt || item.created_at;
            return (
              <Pressable
                style={[s.emailCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handlePress(item)}
              >
                <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
                  <Text style={[s.avatarLetter, { color: colors.primary }]}>
                    {(who || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={s.emailBody}>
                  <View style={s.emailTopRow}>
                    <Text style={[s.senderText, { color: colors.foreground }]} numberOfLines={1}>
                      {who}
                    </Text>
                    <Text style={[s.dateText, { color: colors.mutedForeground }]}>{formatDate(dateStr)}</Text>
                  </View>
                  {item.subject ? (
                    <Text style={[s.subjectText, { color: colors.foreground + "CC" }]} numberOfLines={1}>
                      {item.subject}
                    </Text>
                  ) : null}
                  {item.summary ? (
                    <Text style={[s.summaryText, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.summary}
                    </Text>
                  ) : null}
                </View>
                {rightAction ? <View style={s.rightActions}>{rightAction(item)}</View> : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  pageTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  pageSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerCount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  list: { padding: 16, gap: 8 },
  emailCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarLetter: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emailBody: { flex: 1, minWidth: 0 },
  emailTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  senderText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  subjectText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  rightActions: { gap: 8, alignItems: "center", flexShrink: 0 },
});
