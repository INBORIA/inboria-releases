import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useListFolders, getListFoldersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

type Folder = {
  id: number | string;
  name?: string | null;
  emoji?: string | null;
  emailCount?: number | null;
};

export default function FoldersScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading } = useListFolders();

  const list = (Array.isArray(data) ? data : ((data as { items?: unknown[] } | undefined)?.items ?? [])) as Folder[];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>Mes dossiers</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Tes dossiers personnels Inboria
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
          <MaterialCommunityIcons name="folder-multiple-outline" size={48} color={colors.mutedForeground + "30"} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Aucun dossier</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Crée un dossier depuis le web pour le retrouver ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={[s.grid, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <Pressable
              style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                // Folder detail screen not yet implemented — for now stay here
              }}
            >
              <View style={[s.iconBox, { backgroundColor: colors.primary + "18" }]}>
                {item.emoji ? (
                  <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                ) : (
                  <MaterialCommunityIcons name="folder-outline" size={18} color={colors.primary} />
                )}
              </View>
              <Text style={[s.cardName, { color: colors.foreground }]} numberOfLines={2}>
                {item.name}
              </Text>
              {typeof item.emailCount === "number" ? (
                <Text style={[s.cardCount, { color: colors.mutedForeground }]}>
                  {item.emailCount} mail{item.emailCount > 1 ? "s" : ""}
                </Text>
              ) : null}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  grid: { padding: 16, gap: 12 },
  row: { gap: 12 },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cardCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
