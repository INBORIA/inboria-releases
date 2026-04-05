import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  SectionList,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetProject } from "@workspace/api-client-react";
import type { Email, Task } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function PriorityDot({ priority, colors }: { priority: string; colors: ReturnType<typeof useColors> }) {
  const c =
    priority === "urgent" ? colors.urgent : priority === "moyen" ? colors.moyen : colors.faible;
  return <View style={[styles.priorityDot, { backgroundColor: c }]} />;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const { data: project, isLoading } = useGetProject(id || "");

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={48} color={colors.mutedForeground + "40"} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Projet introuvable</Text>
      </View>
    );
  }

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
  const sc = statusColors[project.status] || colors.mutedForeground;

  const sections = [
    ...(project.emails?.length
      ? [{ title: `Emails (${project.emails.length})`, data: project.emails.map((e: Email) => ({ type: "email" as const, item: e })) }]
      : []),
    ...(project.tasks?.length
      ? [{ title: `Taches (${project.tasks.length})`, data: project.tasks.map((t: Task) => ({ type: "task" as const, item: t })) }]
      : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: project.name }} />

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={[styles.refBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.refText, { color: colors.primary }]}>{project.reference}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: sc + "20" }]}>
                <View style={[styles.statusDot, { backgroundColor: sc }]} />
                <Text style={[styles.statusText, { color: sc }]}>
                  {statusLabels[project.status] || project.status}
                </Text>
              </View>
            </View>
            {project.description ? (
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                {project.description}
              </Text>
            ) : null}
            <View style={[styles.statsRow, { borderColor: colors.border }]}>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.foreground }]}>{project.emails?.length ?? 0}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Emails</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.foreground }]}>{project.tasks?.length ?? 0}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Taches</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.success }]}>
                  {project.tasks?.filter((t: Task) => t.done).length ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Terminees</Text>
              </View>
            </View>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
          </View>
        )}
        renderItem={({ item: { type, item } }) => {
          if (type === "email") {
            const email = item as Email;
            return (
              <TouchableOpacity
                style={[styles.emailRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/email/${email.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primary + "25" }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(email.sender || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.emailContent}>
                  <Text style={[styles.emailSender, { color: colors.foreground }]}>
                    {email.sender}
                  </Text>
                  <Text style={[styles.emailSubject, { color: colors.mutedForeground }]}>
                    {email.subject}
                  </Text>
                </View>
                <PriorityDot priority={email.priority ?? "faible"} colors={colors} />
              </TouchableOpacity>
            );
          }
          const task = item as Task;
          return (
            <View style={[styles.taskRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: task.done ? colors.success : colors.border,
                    backgroundColor: task.done ? colors.success + "20" : "transparent",
                  },
                ]}
              >
                {task.done && <Feather name="check" size={12} color={colors.success} />}
              </View>
              <Text
                style={[
                  styles.taskTitle,
                  {
                    color: task.done ? colors.mutedForeground : colors.foreground,
                    textDecorationLine: task.done ? "line-through" : "none",
                  },
                ]}
              
              >
                {task.title}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.centered, { paddingTop: 40 }]}>
            <Feather name="inbox" size={40} color={colors.mutedForeground + "40"} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Aucun email ni tache
            </Text>
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: isWeb ? 84 : 90 }]}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  refBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  refText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 12 },
  statsRow: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 12 },
  statBox: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statDivider: { width: 1, marginVertical: 4 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  listContent: { paddingBottom: 20 },
  emailRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, borderWidth: 1, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emailContent: { flex: 1 },
  emailSender: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emailSubject: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  taskRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, borderWidth: 1, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
});
