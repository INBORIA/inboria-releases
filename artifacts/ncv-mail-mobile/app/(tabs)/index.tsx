import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListEmails,
  useListCategories,
  useGetDashboardSummary,
  useDeleteEmail,
  useBulkUpdateEmails,
  getListEmailsQueryKey,
  getListCategoriesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/i18n";

const LANGUAGES = [
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "nl", label: "NL", flag: "🇳🇱" },
  { code: "de", label: "DE", flag: "🇩🇪" },
  { code: "es", label: "ES", flag: "🇪🇸" },
];

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
  const { t, i18n } = useTranslation();
  const currentLangCode = (i18n.resolvedLanguage || i18n.language || "fr").substring(0, 2);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const longPressedRef = useRef(false);
  const isWeb = Platform.OS === "web";

  const { data: emailsData, isLoading } = useListEmails({
    priority:
      filterPriority !== "all"
        ? (filterPriority as "urgent" | "moyen" | "faible")
        : undefined,
    q: searchQuery || undefined,
    categoryId: filterCategory ?? undefined,
    limit: 50,
  });
  const emails = (emailsData as PaginatedEmails | undefined)?.emails ?? [];

  const { data: categories } = useListCategories();
  const { data: summary } = useGetDashboardSummary();
  const deleteEmail = useDeleteEmail();
  const bulkUpdate = useBulkUpdateEmails();

  const activeEmails = emails
    ?.sort((a, b) => {
      const pOrder: Record<string, number> = { urgent: 0, moyen: 1, faible: 2 };
      return (pOrder[a.priority ?? "faible"] ?? 2) - (pOrder[b.priority ?? "faible"] ?? 2);
    });

  const selectionMode = selectedIds.size > 0;

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() }),
    ]);
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await invalidateAll();
    setRefreshing(false);
  }, [invalidateAll]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!activeEmails) return;
    if (selectedIds.size === activeEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeEmails.map((e) => e.id)));
    }
  };

  const handleBulkAction = (action: "delete" | "archive" | "read") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const doAction = () => {
      bulkUpdate.mutate(
        { data: { ids, action } },
        {
          onSuccess: () => {
            setSelectedIds(new Set());
            invalidateAll();
          },
        }
      );
    };

    if (action === "delete") {
      Alert.alert(
        t("common.delete"),
        t("inbox.deleteConfirm", { count: ids.length }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.delete"), style: "destructive", onPress: doAction },
        ]
      );
    } else {
      doAction();
    }
  };

  const handleDeleteEmail = (id: number) => {
    deleteEmail.mutate(
      { id },
      { onSuccess: invalidateAll }
    );
  };

  const priorityFilters = [
    { key: "all", label: t("inbox.filterAll") },
    { key: "urgent", label: t("inbox.filterUrgent") },
    { key: "moyen", label: t("inbox.filterMedium") },
    { key: "faible", label: t("inbox.filterLow") },
  ];

  const priorityDotColor = (p: string) =>
    p === "urgent" ? colors.urgent : p === "moyen" ? colors.moyen : colors.faible;

  const hasActiveFilters = filterPriority !== "all" || filterCategory !== null;

  const renderEmail = ({ item }: { item: Email }) => {
    const priority = item.priority ?? "faible";
    const isSelected = selectedIds.has(item.id);

    return (
      <Pressable
        style={[
          s.emailCard,
          {
            backgroundColor: isSelected ? colors.primary + "12" : colors.card,
            borderColor: isSelected ? colors.primary + "50" : colors.border,
          },
        ]}
        onPress={() => {
          if (longPressedRef.current) {
            longPressedRef.current = false;
            return;
          }
          if (selectionMode) {
            toggleSelect(item.id);
          } else {
            router.push(`/email/${item.id}`);
          }
        }}
        onLongPress={() => {
          longPressedRef.current = true;
          toggleSelect(item.id);
        }}
      >
        {selectionMode ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              longPressedRef.current = false;
              toggleSelect(item.id);
            }}
            style={[
              s.avatar,
              {
                backgroundColor: "transparent",
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.mutedForeground + "40",
              },
            ]}
          >
            <View
              style={[
                s.checkbox,
                {
                  backgroundColor: isSelected ? colors.primary : "transparent",
                  borderColor: isSelected ? colors.primary : colors.mutedForeground + "60",
                },
              ]}
            >
              {isSelected && (
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
              )}
            </View>
          </Pressable>
        ) : (
          <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
            <Text style={[s.avatarLetter, { color: colors.primary }]}>
              {(item.sender || "?")[0].toUpperCase()}
            </Text>
          </View>
        )}

        <View style={s.emailBody}>
          <View style={s.emailTopRow}>
            <Text style={[s.senderText, { color: colors.foreground }]}>
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
                  <Text style={[s.chipLabel, { color: colors.primary }]}>{t("inbox.newBadge")}</Text>
                </View>
              )}
              {item.categoryName ? (
                <View style={[s.categoryBadge, { backgroundColor: colors.primary + "12" }]}>
                  <MaterialCommunityIcons name="tag-outline" size={10} color={colors.primary} />
                  <Text style={[s.chipLabel, { color: colors.primary }]}>
                    {item.categoryName}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={s.emailActions}>
              <View style={[s.priorityDot, { backgroundColor: priorityDotColor(priority) }]} />
              {!selectionMode && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteEmail(item.id);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={14} color={colors.destructive + "80"} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}>
      {selectionMode ? (
        <View style={[s.bulkBar, { backgroundColor: colors.primary + "10", borderBottomColor: colors.primary + "30" }]}>
          <View style={s.bulkBarTop}>
            <TouchableOpacity onPress={toggleSelectAll} style={s.bulkSelectAll}>
              <MaterialCommunityIcons
                name={selectedIds.size === (activeEmails?.length || 0) ? "checkbox-marked" : "checkbox-blank-outline"}
                size={18}
                color={colors.primary}
              />
              <Text style={[s.bulkLabel, { color: colors.primary }]}>
                {t("common.selected", { count: selectedIds.size })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={s.bulkActions}>
            <TouchableOpacity
              style={[s.bulkBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleBulkAction("read")}
              disabled={bulkUpdate.isPending}
            >
              <MaterialCommunityIcons name="email-check-outline" size={16} color={colors.primary} />
              <Text style={[s.bulkBtnText, { color: colors.foreground }]}>{t("inbox.read")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bulkBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleBulkAction("archive")}
              disabled={bulkUpdate.isPending}
            >
              <MaterialCommunityIcons name="archive-outline" size={16} color={colors.moyen} />
              <Text style={[s.bulkBtnText, { color: colors.foreground }]}>{t("inbox.archive")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bulkBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}
              onPress={() => handleBulkAction("delete")}
              disabled={bulkUpdate.isPending}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.destructive} />
              <Text style={[s.bulkBtnText, { color: colors.destructive }]}>{t("inbox.deleteBtn")}</Text>
            </TouchableOpacity>
          </View>
          {bulkUpdate.isPending && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />
          )}
        </View>
      ) : (
        <>
          <View style={s.topBar}>
            <TouchableOpacity
              onPress={() => router.push("/menu")}
              hitSlop={8}
              style={[s.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name="menu" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[s.brandTitle, { color: colors.foreground }]}>Inboria</Text>
            <View style={{ flex: 1 }} />
          </View>
          <View style={s.langSwitcherRow}>
            {LANGUAGES.map((lang) => {
              const isActive = currentLangCode === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    s.langBtn,
                    {
                      backgroundColor: isActive ? colors.primary + "20" : colors.card,
                      borderColor: isActive ? colors.primary + "50" : colors.border,
                    },
                  ]}
                  onPress={() => changeLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={s.langFlag}>{lang.flag}</Text>
                  <Text style={[s.langLabel, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.summaryRow}>
            {[
              { label: t("inbox.urgent"), count: summary?.urgentCount ?? 0, color: colors.urgent },
              { label: t("inbox.medium"), count: summary?.moyenCount ?? 0, color: colors.moyen },
              { label: t("inbox.low"), count: summary?.faibleCount ?? 0, color: colors.faible },
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
            <MaterialCommunityIcons name="magnify" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              placeholder={t("common.search")}
              placeholderTextColor={colors.mutedForeground + "80"}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons name="close" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}

      <View style={s.emailArea}>
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !activeEmails?.length ? (
          <View style={s.center}>
            <MaterialCommunityIcons name="email-open-outline" size={48} color={colors.mutedForeground + "40"} />
            <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>{t("inbox.noEmails")}</Text>
          </View>
        ) : (
          <FlatList
            data={activeEmails}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderEmail}
            extraData={selectedIds}
            contentContainerStyle={s.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {!selectionMode && (
        <View style={[s.filterBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {hasActiveFilters && (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => { setFilterPriority("all"); setFilterCategory(null); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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

            {categories && categories.length > 0 && (
              <>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
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
                  <Text
                    style={[
                      s.chipText,
                      { color: filterCategory === null ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {t("common.allFem")}
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
                      <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      )}

      {!selectionMode ? (
        <TouchableOpacity
          onPress={() => router.push("/compose")}
          activeOpacity={0.85}
          style={[s.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        >
          <MaterialCommunityIcons name="pencil" size={22} color={colors.primaryForeground} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  langSwitcherRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 6,
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  langFlag: { fontSize: 14 },
  langLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  bulkBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bulkBarTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bulkSelectAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulkLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  bulkActions: {
    flexDirection: "row",
    gap: 8,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bulkBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

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
    marginBottom: 8,
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

  emailArea: {
    flex: 1,
    minHeight: 0,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },

  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },

  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  clearBtn: {
    padding: 4,
  },
  filtersContent: { gap: 6, alignItems: "center" },
  divider: { width: 1, height: 20, marginHorizontal: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },

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
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

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
