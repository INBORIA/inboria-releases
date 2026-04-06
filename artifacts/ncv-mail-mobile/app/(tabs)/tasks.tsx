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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListTasks,
  useUpdateTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
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
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => toggleTask(item.id, item.done)}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={s.checkArea}
      >
        <View
          style={[
            s.checkbox,
            {
              borderColor: item.done ? colors.success : colors.mutedForeground,
              backgroundColor: item.done ? colors.success : "transparent",
            },
          ]}
        >
          {item.done && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>

      <View style={s.cardBody}>
        <Text
          style={[
            s.taskTitle,
            {
              color: item.done ? colors.mutedForeground : colors.foreground,
              textDecorationLine: item.done ? "line-through" : "none",
            },
          ]}
        >
          {item.title}
        </Text>

        {item.emailSubject ? (
          <View style={s.metaRow}>
            <MaterialCommunityIcons name="email-outline" size={11} color={colors.mutedForeground} style={s.metaIcon} />
            <Text style={[s.metaText, { color: colors.mutedForeground }]}>
              {item.emailSubject}
            </Text>
          </View>
        ) : null}

        {item.projectName ? (
          <View style={s.metaRow}>
            <MaterialCommunityIcons name="folder-outline" size={11} color={colors.primary} style={s.metaIcon} />
            <Text style={[s.metaText, { color: colors.primary }]}>
              {item.projectReference ? `${item.projectReference} - ` : ""}
              {item.projectName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={s.filterRow}>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                s.filterChip,
                {
                  backgroundColor: active ? colors.primary + "20" : colors.card,
                  borderColor: active ? colors.primary + "40" : colors.border,
                },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[s.filterText, { color: active ? colors.primary : colors.mutedForeground }]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !tasks?.length ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="check-circle-outline" size={48} color={colors.mutedForeground + "40"} />
          <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>Aucune tache</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTask}
          contentContainerStyle={[s.list, { paddingBottom: isWeb ? 84 : 100 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },

  list: { paddingHorizontal: 16, gap: 10 },

  card: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: "flex-start",
  },

  checkArea: {
    paddingTop: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
    gap: 6,
  },
  metaIcon: {
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    flex: 1,
  },
});
