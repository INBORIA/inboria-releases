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
import { useRouter } from "expo-router";
import { useListProjects, getListProjectsQueryKey } from "@workspace/api-client-react";
import type { Project } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

const STATUS_COLORS: Record<string, string> = {
  actif: "#22c55e",
  termine: "#8b9cb3",
  en_pause: "#f59e0b",
};

const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  termine: "Termine",
  en_pause: "En pause",
};

export default function ProjectsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const isWeb = Platform.OS === "web";

  const { data: projects, isLoading } = useListProjects();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  const renderProject = ({ item }: { item: Project }) => {
    const sc = STATUS_COLORS[item.status] || colors.mutedForeground;
    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => router.push(`/project/${item.id}`)}
      >
        <View style={s.cardTop}>
          <View style={[s.refBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[s.refLabel, { color: colors.primary }]}>{item.reference}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: sc + "20" }]}>
            <View style={[s.statusDot, { backgroundColor: sc }]} />
            <Text style={[s.statusLabel, { color: sc }]}>
              {STATUS_LABELS[item.status] || item.status}
            </Text>
          </View>
        </View>

        <Text style={[s.projectName, { color: colors.foreground }]}>{item.name}</Text>

        {item.description ? (
          <Text style={[s.projectDesc, { color: colors.mutedForeground }]}>
            {item.description}
          </Text>
        ) : null}

        <View style={s.statsRow}>
          <View style={s.stat}>
            <MaterialCommunityIcons name="email-outline" size={13} color={colors.mutedForeground} />
            <Text style={[s.statText, { color: colors.mutedForeground }]}>
              {item.emailCount ?? 0}
            </Text>
          </View>
          <View style={s.stat}>
            <MaterialCommunityIcons name="checkbox-marked-outline" size={13} color={colors.mutedForeground} />
            <Text style={[s.statText, { color: colors.mutedForeground }]}>
              {item.taskCount ?? 0}
            </Text>
          </View>
          {(item.pendingTaskCount ?? 0) > 0 && (
            <View style={s.stat}>
              <MaterialCommunityIcons name="clock-outline" size={13} color={colors.warning} />
              <Text style={[s.statText, { color: colors.warning }]}>
                {item.pendingTaskCount} en cours
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !projects?.length ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="folder-outline" size={48} color={colors.mutedForeground + "40"} />
          <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>Aucun projet</Text>
          <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
            Les projets sont crees automatiquement par l'IA
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProject}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  list: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  refBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  refLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  projectName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
    lineHeight: 22,
  },
  projectDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 10,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
