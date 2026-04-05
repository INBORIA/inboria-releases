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
import { useListTasks, useUpdateTask } from "@workspace/api-client-react";
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
    await queryClient.invalidateQueries({ queryKey: ["listTasks"] });
    setRefreshing(false);
  }, [queryClient]);

  const toggleTask = (id: number, currentDone: boolean) => {
    if (Platform.OS !== "web" && Haptics) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    updateTask.mutate(
      { id, data: { done: !currentDone } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listTasks"] }) }
    );
  };

  const filters = [
    { key: "pending" as const, label: "En cours" },
    { key: "done" as const, label: "Terminees" },
    { key: "all" as const, label: "Toutes" },
  ];

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={[styles.taskRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => toggleTask(item.id, item.done)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: item.done ? colors.success : colors.border,
            backgroundColor: item.done ? colors.success + "20" : "transparent",
          },
        ]}
      >
        {item.done && <Feather name="check" size={14} color={colors.success} />}
      </View>
      <View style={styles.taskContent}>
        <Text
          style={[
            styles.taskTitle,
            {
              color: item.done ? colors.mutedForeground : colors.foreground,
              textDecorationLine: item.done ? "line-through" : "none",
            },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.emailSubject ? (
          <View style={styles.taskMeta}>
            <Feather name="mail" size={11} color={colors.mutedForeground} />
            <Text style={[styles.taskMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {item.emailSubject}
            </Text>
          </View>
        ) : null}
        {item.projectName ? (
          <View style={styles.taskMeta}>
            <Feather name="folder" size={11} color={colors.primary} />
            <Text style={[styles.taskMetaText, { color: colors.primary }]} numberOfLines={1}>
              {item.projectReference ? `${item.projectReference} - ` : ""}{item.projectName}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.statusIcon, { backgroundColor: item.done ? colors.success + "15" : colors.warning + "15" }]}>
        <Feather
          name={item.done ? "check-circle" : "clock"}
          size={16}
          color={item.done ? colors.success : colors.warning}
        />
      </View>
    </TouchableOpacity>
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
          scrollEnabled={!!tasks?.length}
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  taskMetaText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  statusIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
