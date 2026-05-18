import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetSharedMailboxes,
  useGetSharedMailboxEmails,
  getGetSharedMailboxEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

type SharedBox = { id: number | string; name?: string | null; email?: string | null; emailAddress?: string | null };

export default function SharedScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";
  const [refreshing, setRefreshing] = useState(false);
  const [activeBoxId, setActiveBoxId] = useState<number | string | null>(null);

  const { data: boxesData, isLoading: boxesLoading } = useGetSharedMailboxes();
  const boxes = (Array.isArray(boxesData) ? boxesData : ((boxesData as { items?: unknown[] } | undefined)?.items ?? [])) as SharedBox[];

  const currentId = activeBoxId ?? boxes[0]?.id ?? null;

  const { data: emailsData, isLoading: emailsLoading } = useGetSharedMailboxEmails(
    String(currentId ?? ""),
    undefined,
    {
      query: {
        enabled: !!currentId,
        queryKey: getGetSharedMailboxEmailsQueryKey(String(currentId ?? "")),
      },
    }
  );
  const emails = (Array.isArray(emailsData)
    ? emailsData
    : ((emailsData as { emails?: unknown[] } | undefined)?.emails ?? [])) as Array<{
    id: number;
    sender?: string;
    subject?: string;
    summary?: string;
    createdAt?: string;
  }>;

  const onRefresh = useCallback(async () => {
    if (!currentId) return;
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getGetSharedMailboxEmailsQueryKey(String(currentId)) });
    setRefreshing(false);
  }, [queryClient, currentId]);

  const activeBox = useMemo(() => boxes.find((b) => b.id === currentId), [boxes, currentId]);

  if (boxesLoading) {
    return (
      <View style={[s.container, s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (boxes.length === 0) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.foreground }]}>Partagées</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.empty}>
          <MaterialCommunityIcons name="account-multiple-outline" size={48} color={colors.mutedForeground + "30"} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Aucune boîte partagée</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Active une boîte partagée depuis le web pour la consulter ici.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>Partagées</Text>
          {activeBox ? (
            <Text style={[s.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {activeBox.name || activeBox.emailAddress || activeBox.email}
            </Text>
          ) : null}
        </View>
        <Text style={[s.count, { color: colors.mutedForeground }]}>{emails.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsRow}
        style={{ flexGrow: 0 }}
      >
        {boxes.map((box) => {
          const active = box.id === currentId;
          return (
            <Pressable
              key={String(box.id)}
              onPress={() => setActiveBoxId(box.id)}
              style={[
                s.tabChip,
                {
                  backgroundColor: active ? colors.primary + "20" : colors.card,
                  borderColor: active ? colors.primary + "50" : colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="email-multiple-outline"
                size={14}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text style={[s.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {box.name || box.emailAddress || box.email}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {emailsLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : emails.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="inbox-outline" size={40} color={colors.mutedForeground + "40"} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Cette boîte ne contient aucun mail pour l'instant.
          </Text>
        </View>
      ) : (
        <FlatList
          data={emails}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <Pressable
              style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/email/${item.id}`)}
            >
              <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
                <Text style={[s.avatarLetter, { color: colors.primary }]}>
                  {(item.sender || "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.topRow}>
                  <Text style={[s.sender, { color: colors.foreground }]} numberOfLines={1}>
                    {item.sender}
                  </Text>
                  <Text style={[s.date, { color: colors.mutedForeground }]}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[s.subjectText, { color: colors.foreground + "CC" }]} numberOfLines={1}>
                  {item.subject}
                </Text>
                {item.summary ? (
                  <Text style={[s.summary, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.summary}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
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
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  count: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  tabsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, alignItems: "center" },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sender: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  subjectText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summary: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
