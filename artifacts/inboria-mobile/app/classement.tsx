import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { listCategories } from "@/lib/api";

export default function ClassementScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const items = [...(query.data ?? [])].sort(
    (a, b) => b.emailCount - a.emailCount,
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Catégories" />
      {query.isLoading ? (
        <SkeletonList />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : items.length === 0 ? (
        <CenterState
          icon="tag"
          title="Aucune catégorie"
          subtitle="Inboria classe automatiquement vos e-mails par catégories."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View
              style={[styles.row, { borderBottomColor: colors.mailBorder }]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.avatarBg,
                    borderColor: colors.avatarBorder,
                  },
                ]}
              >
                <Feather name="tag" size={15} color={colors.primary} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: colors.foreground }]}
              >
                {item.name}
              </Text>
              <View
                style={[styles.count, { backgroundColor: colors.surfaceHover }]}
              >
                <Text style={[styles.countText, { color: colors.mailMuted }]}>
                  {item.emailCount}
                </Text>
              </View>
            </View>
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
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, fontSize: 14.5, fontFamily: "Inter_500Medium" },
  count: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: "center",
  },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
