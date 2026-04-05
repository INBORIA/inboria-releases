import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useListEmails, useListCategories } from "@workspace/api-client-react";
import type { Email } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function PriorityDot({ priority }: { priority: string }) {
  const colors = useColors();
  const c =
    priority === "urgent"
      ? colors.urgent
      : priority === "moyen"
        ? colors.moyen
        : colors.faible;
  return <View style={[styles.priorityDot, { backgroundColor: c }]} />;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function InboxScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isWeb = Platform.OS === "web";

  const { data: emails, isLoading } = useListEmails({
    priority: filterPriority !== "all" ? (filterPriority as "urgent" | "moyen" | "faible") : undefined,
    q: searchQuery || undefined,
  });

  const { data: categories } = useListCategories();

  const activeEmails = emails
    ?.filter((e) => e.status !== "archived")
    ?.filter((e) => filterCategory === null || e.categoryId === filterCategory)
    ?.sort((a, b) => {
      const pOrder: Record<string, number> = { urgent: 0, moyen: 1, faible: 2 };
      return (pOrder[a.priority ?? "faible"] ?? 2) - (pOrder[b.priority ?? "faible"] ?? 2);
    });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["listEmails"] });
    await queryClient.invalidateQueries({ queryKey: ["listCategories"] });
    setRefreshing(false);
  }, [queryClient]);

  const priorityFilters = [
    { key: "all", label: "Tous" },
    { key: "urgent", label: "Urgent" },
    { key: "moyen", label: "Moyen" },
    { key: "faible", label: "Faible" },
  ];

  const renderEmail = ({ item }: { item: Email }) => (
    <TouchableOpacity
      style={[styles.emailRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/email/${item.id}`)}
      activeOpacity={0.7}
      testID={`email-${item.id}`}
    >
      <View style={styles.emailLeft}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "25" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(item.sender || "?")[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.emailContent}>
          <View style={styles.emailHeader}>
            <Text style={[styles.senderName, { color: colors.foreground }]}>
              {item.sender}
            </Text>
            {item.status === "unread" && (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            )}
          </View>
          <Text style={[styles.subject, { color: colors.foreground + "CC" }]}>
            {item.subject}
          </Text>
          {item.summary ? (
            <Text style={[styles.summary, { color: colors.mutedForeground }]}>
              {item.summary}
            </Text>
          ) : null}
          {item.categoryName ? (
            <View style={styles.categoryRow}>
              <View style={[styles.categoryChip, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="tag" size={10} color={colors.primary} />
                <Text style={[styles.categoryText, { color: colors.primary }]}>{item.categoryName}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.emailRight}>
        <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
          {formatDate(item.createdAt)}
        </Text>
        <PriorityDot priority={item.priority ?? "faible"} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Rechercher..."
          placeholderTextColor={colors.mutedForeground + "80"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="search-input"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {priorityFilters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              {
                backgroundColor: filterPriority === f.key ? colors.primary + "20" : colors.card,
                borderColor: filterPriority === f.key ? colors.primary + "40" : colors.border,
              },
            ]}
            onPress={() => setFilterPriority(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filterPriority === f.key ? colors.primary : colors.mutedForeground },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {categories && categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: filterCategory === null ? colors.primary + "20" : colors.card,
                borderColor: filterCategory === null ? colors.primary + "40" : colors.border,
              },
            ]}
            onPress={() => setFilterCategory(null)}
          >
            <Feather name="layers" size={12} color={filterCategory === null ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.filterText, { color: filterCategory === null ? colors.primary : colors.mutedForeground }]}>
              Toutes
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filterCategory === cat.id ? colors.primary + "20" : colors.card,
                  borderColor: filterCategory === cat.id ? colors.primary + "40" : colors.border,
                },
              ]}
              onPress={() => setFilterCategory(filterCategory === cat.id ? null : cat.id)}
            >
              <Feather name="tag" size={12} color={filterCategory === cat.id ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.filterText, { color: filterCategory === cat.id ? colors.primary : colors.mutedForeground }]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !activeEmails?.length ? (
        <View style={styles.centered}>
          <Feather name="inbox" size={48} color={colors.mutedForeground + "40"} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Aucun email
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeEmails}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEmail}
          contentContainerStyle={[styles.listContent, { paddingBottom: isWeb ? 84 : 90 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={!!activeEmails?.length}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterScroll: { flexGrow: 0, marginBottom: 4 },
  categoryScroll: { flexGrow: 0, marginBottom: 8 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 16, gap: 8 },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  emailLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emailContent: { flex: 1 },
  emailHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  senderName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  subject: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  summary: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  categoryRow: { flexDirection: "row", marginTop: 4 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  emailRight: { alignItems: "flex-end", gap: 6, marginLeft: 8 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
});
