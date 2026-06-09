import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { listFolders } from "@/lib/api";

export default function FoldersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const query = useQuery({ queryKey: ["folders"], queryFn: listFolders });
  const folders = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Mes dossiers" />
      {query.isLoading ? (
        <SkeletonList />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : folders.length === 0 ? (
        <CenterState
          icon="folder"
          title="Aucun dossier"
          subtitle="Créez des dossiers depuis l'app web pour les retrouver ici."
        />
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 6 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/folder/[id]",
                  params: { id: item.id, name: item.name },
                })
              }
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: colors.mailBorder,
                  backgroundColor: pressed ? colors.surfaceHover : "transparent",
                },
              ]}
            >
              <View
                style={[
                  styles.icon,
                  { backgroundColor: colors.avatarBg, borderColor: colors.avatarBorder },
                ]}
              >
                <Feather name="folder" size={16} color={colors.primary} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: colors.foreground }]}
              >
                {item.name}
              </Text>
              {item.emailCount > 0 ? (
                <Text style={[styles.count, { color: colors.mailMuted }]}>
                  {item.emailCount}
                </Text>
              ) : null}
              <Feather name="chevron-right" size={18} color={colors.faint} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  count: { fontSize: 13, fontFamily: "Inter_400Regular", marginRight: 4 },
});
