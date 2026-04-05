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
import {
  useListEmails,
  useListCategories,
  useGetDashboardSummary,
  useDeleteEmail,
  getListEmailsQueryKey,
  getListCategoriesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Email } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isWeb = Platform.OS === "web";

  const { data: emails, isLoading } = useListEmails({
    priority:
      filterPriority !== "all"
        ? (filterPriority as "urgent" | "moyen" | "faible")
        : undefined,
    q: searchQuery || undefined,
  });

  const { data: categories } = useListCategories();
  const { data: summary } = useGetDashboardSummary();
  const deleteEmail = useDeleteEmail();

  const activeEmails = emails
    ?.filter((e) => e.status !== "archived")
    ?.filter((e) => filterCategory === null || e.categoryId === filterCategory)
    ?.sort((a, b) => {
      const pOrder: Record<string, number> = { urgent: 0, moyen: 1, faible: 2 };
      return (pOrder[a.priority ?? "faible"] ?? 2) - (pOrder[b.priority ?? "faible"] ?? 2);
    });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  const handleDeleteEmail = (id: number) => {
    deleteEmail.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      }
    );
  };

  const priorityFilters = [
    { key: "all", label: "Tous" },
    { key: "urgent", label: "Urgent" },
    { key: "moyen", label: "Moyen" },
    { key: "faible", label: "Faible" },
  ];

  const priorityDotColor = (p: string) =>
    p === "urgent" ? colors.urgent : p === "moyen" ? colors.moyen : colors.faible;

  const renderEmail = ({ item }: { item: Email }) => {
    const priority = item.priority ?? "faible";
    return (
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
            <Text style={[s.senderText, { color: colors.foreground }]} numberOfLines={1}>
              {item.sender}
            </Text>
            <Text style={[s.dateText, { color: colors.mutedForeground }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>

          <Text style={[s.subjectText, { color: colors.foreground + "DD" }]}>
            {item.subject}
          </Text>

          {item.summary ? (
            <Text style={[s.summaryText, { color: colors.mutedForeground }]}>
              {item.summary}
            </Text>
          ) : null}

          <View style={s.emailBottomRow}>
            <View style={s.emailChips}>
              {item.status === "unread" && (
                <View style={[s.unreadBadge, { backgroundColor: colors.primary + "20" }]}>
                  <View style={[s.unreadDot, { backgroundColor: colors.primary }]} />
                  <Text style={[s.chipLabel, { color: colors.primary }]}>Nouveau</Text>
                </View>
              )}
              {item.categoryName ? (
                <View style={[s.categoryBadge, { backgroundColor: colors.primary + "12" }]}>
                  <Feather name="tag" size={10} color={colors.primary} />
                  <Text style={[s.chipLabel, { color: colors.primary }]}>
                    {item.categoryName}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={s.emailActions}>
              <View style={[s.priorityDot, { backgroundColor: priorityDotColor(priority) }]} />
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteEmail(item.id);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="trash-2" size={14} color={colors.destructive + "80"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      <View style={s.summaryRow}>
        {[
          { label: "Urgents", count: summary?.urgentCount ?? 0, color: colors.urgent },
          { label: "Moyens", count: summary?.moyenCount ?? 0, color: colors.moyen },
          { label: "Faibles", count: summary?.faibleCount ?? 0, color: colors.faible },
        ].map((card) => (
          <View
            key={card.label}
            style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[s.summaryLabel, { color: card.color }]}>{card.label}</Text>
            <Text style={[s.summaryCount, { color: colors.foreground }]}>{card.count}</Text>
          </View>
        ))}
      </View>

      <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="Rechercher..."
          placeholderTextColor={colors.mutedForeground + "80"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filtersScroll}
        contentContainerStyle={s.filtersContent}
      >
        {priorityFilters.map((f) => {
          const active = filterPriority === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                s.chip,
                {
                  backgroundColor: active ? colors.primary + "20" : colors.card,
                  borderColor: active ? colors.primary + "40" : colors.border,
                },
              ]}
              onPress={() => setFilterPriority(f.key)}
            >
              <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {categories && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filtersScroll}
          contentContainerStyle={s.filtersContent}
        >
          <TouchableOpacity
            style={[
              s.chip,
              {
                backgroundColor: filterCategory === null ? colors.primary + "20" : colors.card,
                borderColor: filterCategory === null ? colors.primary + "40" : colors.border,
              },
            ]}
            onPress={() => setFilterCategory(null)}
          >
            <Feather
              name="layers"
              size={12}
              color={filterCategory === null ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                s.chipText,
                { color: filterCategory === null ? colors.primary : colors.mutedForeground },
              ]}
            >
              Toutes
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => {
            const active = filterCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  s.chip,
                  {
                    backgroundColor: active ? colors.primary + "20" : colors.card,
                    borderColor: active ? colors.primary + "40" : colors.border,
                  },
                ]}
                onPress={() => setFilterCategory(active ? null : cat.id)}
              >
                <Feather name="tag" size={12} color={active ? colors.primary : colors.mutedForeground} />
                <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !activeEmails?.length ? (
        <View style={s.center}>
          <Feather name="inbox" size={48} color={colors.mutedForeground + "40"} />
          <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>Aucun email</Text>
        </View>
      ) : (
        <FlatList
          data={activeEmails}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEmail}
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

  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryCount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },

  filtersScroll: { flexGrow: 0, marginBottom: 4 },
  filtersContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },

  list: { paddingHorizontal: 16, gap: 10 },

  emailCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarLetter: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  emailBody: {
    flex: 1,
    minWidth: 0,
  },

  emailTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  senderText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },

  subjectText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginBottom: 2,
  },

  emailBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  emailChips: { flexDirection: "row", gap: 6, flexShrink: 1, flexWrap: "wrap" },
  emailActions: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },

  unreadBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadDot: { width: 6, height: 6, borderRadius: 3 },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
});
