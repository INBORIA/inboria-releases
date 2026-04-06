import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListEmails,
  useListCategories,
  useUpdateEmail,
  useDeleteEmail,
  getListEmailsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const CATEGORY_COLORS = [
  { bg: "#3b82f615", fg: "#3b82f6" },
  { bg: "#a855f715", fg: "#a855f7" },
  { bg: "#22c55e15", fg: "#22c55e" },
  { bg: "#f59e0b15", fg: "#f59e0b" },
  { bg: "#ef444415", fg: "#ef4444" },
  { bg: "#06b6d415", fg: "#06b6d4" },
  { bg: "#ec489915", fg: "#ec4899" },
  { bg: "#6366f115", fg: "#6366f1" },
];

export default function ArchivesScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: allEmails, isLoading } = useListEmails();
  const { data: categories } = useListCategories();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();

  const archivedEmails = allEmails?.filter((e) => e.status === "archived") || [];

  const emailsByCategory: Record<string, typeof archivedEmails> = {};
  const uncategorized: typeof archivedEmails = [];

  archivedEmails.forEach((email) => {
    const catName = email.categoryName || null;
    if (catName) {
      if (!emailsByCategory[catName]) emailsByCategory[catName] = [];
      emailsByCategory[catName].push(email);
    } else {
      uncategorized.push(email);
    }
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleRestore = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "non_lu" } },
      { onSuccess: () => invalidateAll() }
    );
  };

  const handleDelete = (id: number) => {
    Alert.alert("Supprimer", "Supprimer cet email definitivement ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => deleteEmail.mutate({ id }, { onSuccess: () => invalidateAll() }),
      },
    ]);
  };

  const categoryList = Object.keys(emailsByCategory).sort();
  if (uncategorized.length > 0) categoryList.push("Non classe");

  if (selectedCategory) {
    const selectedEmails =
      selectedCategory === "Non classe" ? uncategorized : emailsByCategory[selectedCategory] || [];

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => setSelectedCategory(null)}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
            <Text style={[s.backText, { color: colors.mutedForeground }]}>Archives</Text>
          </TouchableOpacity>
          <Text style={[s.headerCount, { color: colors.mutedForeground }]}>
            {selectedEmails.length} email(s)
          </Text>
        </View>

        <Text style={[s.catTitle, { color: colors.foreground }]}>{selectedCategory}</Text>

        <FlatList
          data={selectedEmails}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.emailCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/email/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
                <Text style={[s.avatarLetter, { color: colors.primary }]}>
                  {(item.sender || "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={s.emailBody}>
                <View style={s.emailTopRow}>
                  <Text style={[s.senderText, { color: colors.foreground }]}>{item.sender}</Text>
                  <Text style={[s.dateText, { color: colors.mutedForeground }]}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[s.subjectText, { color: colors.foreground + "CC" }]} numberOfLines={1}>
                  {item.subject}
                </Text>
                {item.summary ? (
                  <Text style={[s.summaryText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.summary}
                  </Text>
                ) : null}
              </View>
              <View style={s.emailActions}>
                <TouchableOpacity
                  onPress={() => handleRestore(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="inbox-arrow-down" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.destructive + "80"} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <MaterialCommunityIcons name="folder-open-outline" size={40} color={colors.mutedForeground + "40"} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Aucun email dans cette categorie
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
          <Text style={[s.backText, { color: colors.mutedForeground }]}>Retour</Text>
        </TouchableOpacity>
      </View>

      <View style={s.titleRow}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>Archives</Text>
        <Text style={[s.pageSubtitle, { color: colors.mutedForeground }]}>
          Emails classes par l'IA. {archivedEmails.length} email(s) archives.
        </Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : archivedEmails.length === 0 ? (
        <View style={s.emptyBox}>
          <MaterialCommunityIcons name="archive-outline" size={48} color={colors.mutedForeground + "30"} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Aucune archive</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Les emails archives apparaitront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={categoryList}
          keyExtractor={(item) => item}
          numColumns={2}
          contentContainerStyle={s.gridContent}
          columnWrapperStyle={s.gridRow}
          renderItem={({ item: catName, index }) => {
            const count = catName === "Non classe" ? uncategorized.length : emailsByCategory[catName]?.length || 0;
            const colorSet = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <TouchableOpacity
                style={[s.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedCategory(catName)}
                activeOpacity={0.7}
              >
                <View style={[s.catIcon, { backgroundColor: colorSet.bg }]}>
                  <MaterialCommunityIcons name="folder-open-outline" size={18} color={colorSet.fg} />
                </View>
                <Text style={[s.catName, { color: colors.foreground }]}>{catName}</Text>
                <View style={[s.catCount, { backgroundColor: colors.foreground + "08" }]}>
                  <Text style={[s.catCountNum, { color: colors.primary }]}>{count}</Text>
                  <Text style={[s.catCountLabel, { color: colors.mutedForeground }]}> email{count !== 1 ? "s" : ""}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  headerCount: { fontSize: 13, fontFamily: "Inter_400Regular" },

  titleRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  pageSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  catTitle: { fontSize: 18, fontFamily: "Inter_700Bold", paddingHorizontal: 16, paddingBottom: 8 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  gridContent: { padding: 16, gap: 10 },
  gridRow: { gap: 10 },
  categoryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catCount: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  catCountNum: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  catCountLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  list: { padding: 16, gap: 8 },
  emailCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarLetter: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emailBody: { flex: 1, minWidth: 0 },
  emailTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  senderText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  subjectText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  emailActions: { gap: 12, alignItems: "center", flexShrink: 0 },
});
