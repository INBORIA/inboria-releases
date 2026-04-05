import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useListTasks, useUpdateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

let Haptics: typeof import("expo-haptics") | null = null;
try {
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

export default function TasksScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");
  const [refreshing, setRefreshing] = useState(false);
  const isWeb = Platform.OS === "web";

  const { data: tasks, isLoading } = useListTasks({ status: filter });
  const updateTask = useUpdateTask();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  const toggleTask = (id: string, currentDone: boolean) => {
    if (Platform.OS !== "web" && Haptics) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    const queryKey = getListTasksQueryKey({ status: filter });
    const previousTasks = queryClient.getQueryData<Task[]>(queryKey);

    queryClient.setQueryData<Task[]>(queryKey, (old) =>
      old?.map((t) => (t.id === id ? { ...t, done: !currentDone } : t))
    );

    updateTask.mutate(
      { id, data: { done: !currentDone } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
        onError: () => {
          queryClient.setQueryData(queryKey, previousTasks);
        },
      }
    );
  };

  const filters = [
    { key: "pending" as const, label: "En cours" },
    { key: "done" as const, label: "Terminees" },
    { key: "all" as const, label: "Toutes" },
  ];

  const renderTask = ({ item }: { item: Task }) => (
    <View style={[styles.taskRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => toggleTask(item.id, item.done)}
        activeOpacity={0.6}
        style={styles.checkboxTouchable}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: item.done ? colors.success : colors.mutedForeground,
              backgroundColor: item.done ? colors.success : "transparent",
            },
          ]}
        >
          {item.done && <Feather name="check" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
      <View style={styles.taskContent}>
        <Text
          style={[
            styles.taskTitle,
            {
              color: item.done ? colors.mutedForeground : colors.foreground,
              textDecorationLine: item.done ? "line-through" : "none",
            },
          ]}
        >
          {item.title}
        </Text>
        {item.emailSubject ? (
          <View style={styles.taskMeta}>
            <Feather name="mail" size={11} color={colors.mutedForeground} />
            <Text style={[styles.taskMetaText, { color: colors.mutedForeground }]}>
              {item.emailSubject}
            </Text>
          </View>
        ) : null}
        {item.projectName ? (
          <View style={styles.taskMeta}>
            <Feather name="folder" size={11} color={colors.primary} />
            <Text style={[styles.taskMetaText, { color: colors.primary }]}>
              {item.projectReference ? `${item.projectReference} - ` : ""}{item.projectName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f.key ? colors.primary + "20" : colors.card,
                borderColor: filter === f.key ? colors.primary + "40" : colors.border,
              },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f.key ? colors.primary : colors.mutedForeground },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !tasks?.length ? (
        <View style={styles.centered}>
          <Feather name="check-circle" size={48} color={colors.mutedForeground + "40"} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Aucune tache
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTask}
          contentContainerStyle={[styles.listContent, { paddingBottom: isWeb ? 84 : 90 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginTop: 8, marginBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 16, gap: 8 },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  checkboxTouchable: {
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  taskMeta: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 6 },
  taskMetaText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
});
