import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGetProject } from "@workspace/api-client-react";
import type { Email, Task } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type AppColors = ReturnType<typeof useColors>;

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

function EmailItem({ email, colors, onPress }: { email: Email; colors: AppColors; onPress: () => void }) {
  const dotColor =
    email.priority === "urgent"
      ? colors.urgent
      : email.priority === "moyen"
        ? colors.moyen
        : colors.faible;
  return (
    <TouchableOpacity
      style={[s.emailRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
        <Text style={[s.avatarText, { color: colors.primary }]}>
          {(email.sender || "?")[0].toUpperCase()}
        </Text>
      </View>
      <View style={s.emailContent}>
        <Text style={[s.emailSender, { color: colors.foreground }]}>{email.sender}</Text>
        <Text style={[s.emailSubject, { color: colors.mutedForeground }]}>{email.subject}</Text>
      </View>
      <View style={[s.priorityDot, { backgroundColor: dotColor }]} />
    </TouchableOpacity>
  );
}

function TaskItem({ task, colors }: { task: Task; colors: AppColors }) {
  return (
    <View style={[s.taskRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View
        style={[
          s.taskCheck,
          {
            borderColor: task.done ? colors.success : colors.border,
            backgroundColor: task.done ? colors.success : "transparent",
          },
        ]}
      >
        {task.done && <MaterialCommunityIcons name="check" size={12} color="#fff" />}
      </View>
      <Text
        style={[
          s.taskTitle,
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
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const { data: project, isLoading } = useGetProject(id || "");

  if (isLoading) {
    return (
      <View style={[s.full, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[s.full, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.mutedForeground + "40"} />
        <Text style={[s.emptyLabel, { color: colors.mutedForeground, marginTop: 12 }]}>
          Projet introuvable
        </Text>
      </View>
    );
  }

  const sc = STATUS_COLORS[project.status] || colors.mutedForeground;
  const emails = project.emails ?? [];
  const tasks = project.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.done).length;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: project.name }} />

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: isWeb ? 84 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={s.headerTopRow}>
            <View style={[s.refBadge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[s.refText, { color: colors.primary }]}>{project.reference}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: sc + "20" }]}>
              <View style={[s.statusDot, { backgroundColor: sc }]} />
              <Text style={[s.statusText, { color: sc }]}>
                {STATUS_LABELS[project.status] || project.status}
              </Text>
            </View>
          </View>

          {project.description ? (
            <Text style={[s.desc, { color: colors.mutedForeground }]}>{project.description}</Text>
          ) : null}

          <View style={[s.statsCard, { borderColor: colors.border }]}>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: colors.foreground }]}>{emails.length}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Emails</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: colors.foreground }]}>{tasks.length}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Taches</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: colors.success }]}>{doneTasks}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Terminees</Text>
            </View>
          </View>
        </View>

        {emails.length > 0 && (
          <>
            <View style={[s.sectionHeader, { backgroundColor: colors.background }]}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                Emails ({emails.length})
              </Text>
            </View>
            {emails.map((email) => (
              <EmailItem
                key={email.id}
                email={email}
                colors={colors}
                onPress={() => router.push(`/email/${email.id}`)}
              />
            ))}
          </>
        )}

        {tasks.length > 0 && (
          <>
            <View style={[s.sectionHeader, { backgroundColor: colors.background }]}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                Taches ({tasks.length})
              </Text>
            </View>
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} colors={colors} />
            ))}
          </>
        )}

        {emails.length === 0 && tasks.length === 0 && (
          <View style={[s.full, { paddingTop: 40 }]}>
            <MaterialCommunityIcons name="email-open-outline" size={40} color={colors.mutedForeground + "40"} />
            <Text style={[s.emptyLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
              Aucun email ni tache
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  full: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },

  scrollContent: { paddingBottom: 20 },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  refBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  refText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  desc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 12 },

  statsCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statBox: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statDivider: { width: 1, marginVertical: 4 },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emailContent: { flex: 1, minWidth: 0 },
  emailSender: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  emailSubject: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  taskTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 19,
  },
});
