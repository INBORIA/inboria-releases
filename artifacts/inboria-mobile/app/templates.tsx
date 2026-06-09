import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { listTemplates } from "@/lib/api";

export default function TemplatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const items = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Templates" />
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
          icon="file-text"
          title="Aucun template"
          subtitle="Enregistrez vos réponses fréquentes en templates réutilisables."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
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
                <Feather name="file-text" size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: colors.foreground }]}
                >
                  {item.name}
                </Text>
                {item.subject ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.sub, { color: colors.mailMuted }]}
                  >
                    {item.subject}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.usage, { color: colors.mailMeta }]}>
                {item.usageCount}×
              </Text>
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
    paddingVertical: 12,
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
  name: { fontSize: 14.5, fontFamily: "Inter_500Medium" },
  sub: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  usage: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
});
