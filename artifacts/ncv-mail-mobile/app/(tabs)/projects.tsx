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
import { useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

export default function ProjectsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const isWeb = Platform.OS === "web";

  const { data: projects, isLoading } = useListProjects();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["listProjects"] });
    setRefreshing(false);
  }, [queryClient]);

  const statusColors: Record<string, string> = {
    actif: "#22c55e",
    termine: "#8b9cb3",
    en_pause: "#f59e0b",
  };

  const statusLabels: Record<string, string> = {
    actif: "Actif",
    termine: "Termine",
    en_pause: "En pause",
  };

  const renderProject = ({ item }: { item: any }) => {
    const sc = statusColors[item.status] || colors.mutedForeground;
    return (
      <TouchableOpacity
        style={[styles.projectRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.7}
      >
        <View style={styles.projectHeader}>
          <View style={[styles.refBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.refText, { color: colors.primary }]}>{item.reference}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: sc }]} />
            <Text style={[styles.statusText, { color: sc }]}>
              {statusLabels[item.status] || item.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.projectName, { color: colors.foreground }]}>{item.name}</Text>
        {item.description ? (
          <Text style={[styles.projectDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.projectStats}>
          <View style={styles.statItem}>
            <Feather name="mail" size={13} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
              {item.emailCount ?? 0}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Feather name="check-square" size={13} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
              {item.taskCount ?? 0}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !projects?.length ? (
        <View style={styles.centered}>
          <Feather name="folder" size={48} color={colors.mutedForeground + "40"} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Aucun projet
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProject}
          contentContainerStyle={[styles.listContent, { paddingBottom: isWeb ? 84 : 90 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          scrollEnabled={!!projects?.length}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  projectRow: { padding: 16, borderRadius: 12, borderWidth: 1 },
  projectHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  refBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  refText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  projectName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  projectDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },
  projectStats: { flexDirection: "row", gap: 16 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
