import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

const SUGGESTED_ICONS: Record<string, { icon: any; color: string }> = {
  billing: { icon: "receipt" as const, color: "#f59e0b" },
  support: { icon: "headphones" as const, color: "#3b82f6" },
  sales: { icon: "trending-up" as const, color: "#22c55e" },
  admin: { icon: "file-document-outline" as const, color: "#a855f7" },
  newsletter: { icon: "email-newsletter" as const, color: "#06b6d4" },
  hr: { icon: "account-group-outline" as const, color: "#ec4899" },
  suppliers: { icon: "briefcase-outline" as const, color: "#f97316" },
  legal: { icon: "shield-check-outline" as const, color: "#ef4444" },
  tech: { icon: "wrench-outline" as const, color: "#6366f1" },
  training: { icon: "book-open-page-variant-outline" as const, color: "#14b8a6" },
};

const SUGGESTED_KEYS = ["billing", "support", "sales", "admin", "newsletter", "hr", "suppliers", "legal", "tech", "training"];

const CAT_COLORS = [
  { bg: "#3b82f615", fg: "#3b82f6" },
  { bg: "#a855f715", fg: "#a855f7" },
  { bg: "#22c55e15", fg: "#22c55e" },
  { bg: "#f59e0b15", fg: "#f59e0b" },
  { bg: "#ef444415", fg: "#ef4444" },
  { bg: "#06b6d415", fg: "#06b6d4" },
  { bg: "#ec489915", fg: "#ec4899" },
  { bg: "#6366f115", fg: "#6366f1" },
];

export default function CategoriesScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const isWeb = Platform.OS === "web";

  const { data: categories, isLoading } = useListCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [showSuggestions, setShowSuggestions] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [addingNames, setAddingNames] = useState<Set<string>>(new Set());

  const suggestedCategories = useMemo(() => {
    return SUGGESTED_KEYS.map((key) => ({
      key,
      name: t(`categories.suggested.${key}.name`),
      description: t(`categories.suggested.${key}.desc`),
      ...SUGGESTED_ICONS[key],
    }));
  }, [t]);

  const existingNames = useMemo(() => {
    return new Set((categories || []).map((c: any) => c.name.toLowerCase()));
  }, [categories]);

  const availableSuggestions = useMemo(() => {
    return suggestedCategories.filter((s) => !existingNames.has(s.name.toLowerCase()));
  }, [existingNames, suggestedCategories]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
  };

  const handleAddSuggestion = (s: (typeof suggestedCategories)[0]) => {
    setAddingNames((prev) => new Set(prev).add(s.name));
    createCategory.mutate(
      { data: { name: s.name, description: s.description } },
      {
        onSuccess: () => {
          invalidate();
          setAddingNames((prev) => {
            const next = new Set(prev);
            next.delete(s.name);
            return next;
          });
        },
        onError: () => {
          setAddingNames((prev) => {
            const next = new Set(prev);
            next.delete(s.name);
            return next;
          });
        },
      }
    );
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCategory.mutate(
      { data: { name: newName.trim(), description: newDescription.trim() || undefined } },
      {
        onSuccess: () => {
          invalidate();
          setCreateModal(false);
          setNewName("");
          setNewDescription("");
        },
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert(t("common.delete"), t("categories.deleteConfirm", { name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => deleteCategory.mutate({ id }, { onSuccess: invalidate }),
      },
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
          <Text style={[s.backText, { color: colors.mutedForeground }]}>{t("common.back")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setCreateModal(true)}
        >
          <MaterialCommunityIcons name="plus" size={16} color="#fff" />
          <Text style={s.addBtnLabel}>{t("common.new")}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories || []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[s.listContent, { paddingBottom: isWeb ? 84 : 100 }]}
        ListHeaderComponent={
          <>
            <View style={s.titleRow}>
              <Text style={[s.pageTitle, { color: colors.foreground }]}>{t("categories.title")}</Text>
              <Text style={[s.pageSubtitle, { color: colors.mutedForeground }]}>
                {t("categories.subtitle")}
              </Text>
            </View>

            {showSuggestions && availableSuggestions.length > 0 && (
              <View style={[s.suggestionsBox, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "25" }]}>
                <View style={s.suggestionsHeader}>
                  <View style={s.suggestionsTitle}>
                    <View style={[s.suggestIcon, { backgroundColor: colors.primary + "15" }]}>
                      <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.primary} />
                    </View>
                    <Text style={[s.suggestLabel, { color: colors.foreground }]}>{t("common.suggestions")}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                    <Text style={[s.hideText, { color: colors.mutedForeground }]}>{t("common.hide")}</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.suggestionsGrid}>
                  {availableSuggestions.map((sug) => {
                    const isAdding = addingNames.has(sug.name);
                    return (
                      <TouchableOpacity
                        key={sug.key}
                        style={[s.suggestChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => handleAddSuggestion(sug)}
                        disabled={isAdding}
                        activeOpacity={0.7}
                      >
                        <View style={[s.suggestChipIcon, { backgroundColor: sug.color + "15" }]}>
                          {isAdding ? (
                            <ActivityIndicator size="small" color={sug.color} />
                          ) : (
                            <MaterialCommunityIcons name={sug.icon} size={14} color={sug.color} />
                          )}
                        </View>
                        <Text style={[s.suggestChipName, { color: colors.foreground }]} numberOfLines={1}>
                          {sug.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const colorSet = CAT_COLORS[index % CAT_COLORS.length];
          return (
            <View style={[s.catCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.catCardTop}>
                <View style={[s.catCardIcon, { backgroundColor: colorSet.bg }]}>
                  <MaterialCommunityIcons name="tag-outline" size={16} color={colorSet.fg} />
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.name)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.destructive + "60"} />
                </TouchableOpacity>
              </View>
              <Text style={[s.catCardName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[s.catCardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.description || t("categories.noDescription")}
              </Text>
              <View style={[s.catCardCount, { backgroundColor: colors.foreground + "08" }]}>
                <Text style={[s.catCountNum, { color: colors.primary }]}>{item.emailCount || 0}</Text>
                <Text style={[s.catCountLabel, { color: colors.mutedForeground }]}> {t("common.emails")}</Text>
              </View>
            </View>
          );
        }}
        numColumns={2}
        columnWrapperStyle={s.gridRow}
        ListEmptyComponent={
          isLoading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={s.emptyBox}>
              <MaterialCommunityIcons name="tag-outline" size={48} color={colors.mutedForeground + "30"} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>{t("categories.noCategories")}</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {t("categories.noCategoriesDesc")}
              </Text>
            </View>
          )
        }
      />

      <Modal visible={createModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>{t("categories.newCategory")}</Text>
            <Text style={[s.modalLabel, { color: colors.mutedForeground }]}>{t("categories.nameLabel")}</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("categories.namePlaceholder")}
              placeholderTextColor={colors.mutedForeground + "80"}
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={[s.modalLabel, { color: colors.mutedForeground }]}>{t("categories.descLabel")}</Text>
            <TextInput
              style={[s.modalInput, s.modalTextarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("categories.descPlaceholder")}
              placeholderTextColor={colors.mutedForeground + "80"}
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalCancel, { borderColor: colors.border }]}
                onPress={() => { setCreateModal(false); setNewName(""); setNewDescription(""); }}
              >
                <Text style={[s.modalCancelText, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSubmit, { backgroundColor: colors.primary, opacity: !newName.trim() ? 0.5 : 1 }]}
                onPress={handleCreate}
                disabled={!newName.trim() || createCategory.isPending}
              >
                {createCategory.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalSubmitText}>{t("categories.create")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnLabel: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  listContent: { padding: 16 },
  titleRow: { marginBottom: 16 },
  pageTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  pageSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },

  suggestionsBox: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  suggestionsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  suggestionsTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  suggestIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  suggestLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  hideText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  suggestionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  suggestChipIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  suggestChipName: { fontSize: 12, fontFamily: "Inter_500Medium" },

  gridRow: { gap: 10, marginBottom: 10 },
  catCard: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  catCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catCardIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catCardName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catCardDesc: { fontSize: 11, fontFamily: "Inter_400Regular", height: 30 },
  catCardCount: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  catCountNum: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  catCountLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyBox: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "center", padding: 24 },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  modalLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  modalInput: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 14 },
  modalTextarea: { height: 80, paddingTop: 10, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  modalSubmit: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  modalSubmitText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
