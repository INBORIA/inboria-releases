import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { listTasks, toggleTask } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function TachesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const items = query.data ?? [];

  const mutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      toggleTask(id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Mes tâches" />
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
          icon="check-square"
          title="Aucune tâche"
          subtitle="Les tâches créées depuis vos e-mails apparaîtront ici."
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
              <Pressable
                hitSlop={8}
                onPress={() =>
                  mutation.mutate({ id: item.id, done: !item.done })
                }
                style={[
                  styles.check,
                  {
                    borderColor: item.done ? colors.primary : colors.mailBorder,
                    backgroundColor: item.done ? colors.primary : "transparent",
                  },
                ]}
              >
                {item.done ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : null}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.title,
                    {
                      color: item.done ? colors.mailMuted : colors.foreground,
                      textDecorationLine: item.done ? "line-through" : "none",
                    },
                  ]}
                >
                  {item.title}
                </Text>
                {item.emailSubject ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.sub, { color: colors.mailMuted }]}
                  >
                    {item.emailSubject}
                  </Text>
                ) : null}
              </View>
              {item.dueDate ? (
                <Text style={[styles.date, { color: colors.mailMuted }]}>
                  {formatDate(item.dueDate)}
                </Text>
              ) : null}
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
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14.5, fontFamily: "Inter_500Medium" },
  sub: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  date: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
