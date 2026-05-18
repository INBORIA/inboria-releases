import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useListFollowups,
  useDismissFollowup,
  getListFollowupsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

type FU = {
  id: number;
  emailId?: number;
  recipient?: string | null;
  subject?: string | null;
  dueAt?: string | null;
  due_at?: string | null;
  status?: string | null;
  kind?: string | null;
};

function formatDue(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function FollowupsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useListFollowups();
  const dismiss = useDismissFollowup();

  const list = (Array.isArray(data) ? data : ((data as { items?: unknown[] } | undefined)?.items ?? [])) as unknown as FU[];

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListFollowupsQueryKey() });
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>Relances</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Mails à relancer (sans réponse)
          </Text>
        </View>
        <Text style={[s.count, { color: colors.mutedForeground }]}>{list.length}</Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="rotate-right" size={48} color={colors.mutedForeground + "30"} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Aucune relance</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Inboria détecte automatiquement les mails sans réponse.
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const due = formatDue(item.dueAt ?? item.due_at);
            return (
              <Pressable
                style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => item.emailId && router.push(`/email/${String(item.emailId)}` as never)}
              >
                <View style={[s.iconBox, { backgroundColor: colors.primary + "18" }]}>
                  <MaterialCommunityIcons name="rotate-right" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.subjectText, { color: colors.foreground }]} numberOfLines={1}>
                    {item.subject ?? "(sans objet)"}
                  </Text>
                  <Text style={[s.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.recipient ?? ""} {due ? `· échéance ${due}` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => dismiss.mutate({ id: String(item.id) }, { onSuccess: refresh })}
                  hitSlop={10}
                  style={s.dismiss}
                >
                  <MaterialCommunityIcons name="close" size={16} color={colors.mutedForeground} />
                </Pressable>
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
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  count: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  subjectText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  dismiss: { padding: 6 },
});
