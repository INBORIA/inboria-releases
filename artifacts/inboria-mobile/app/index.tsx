import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmailRow } from "@/components/EmailRow";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import {
  listCategories,
  listEmails,
  type EmailListItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Sort = "smart" | "recent";
type Priority = "urgent" | "moyen" | null;

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();

  const [sort, setSort] = useState<Sort>("recent");
  const [priority, setPriority] = useState<Priority>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  // Debounce de la recherche pour ne pas requêter à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["emails", "inbox", sort, priority, categoryId, q],
    queryFn: () =>
      listEmails({
        sort,
        status: "inbox",
        limit: 40,
        q: q || undefined,
        priority: priority || undefined,
        categoryId: categoryId ?? undefined,
      }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  });

  const emails = query.data?.emails ?? [];
  const categories = (categoriesQuery.data ?? []).filter((c) => c.emailCount > 0);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const allActive = priority === null && categoryId === null;

  function openEmail(email: EmailListItem) {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: "/email/[id]", params: { id: String(email.id) } });
  }

  function tap() {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerTop}>
          <Image
            source={require("../assets/images/inboria-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Pressable
            onPress={() => signOut()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: pressed ? colors.surfaceHover : "transparent" },
            ]}
          >
            <Feather name="log-out" size={19} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Recherche */}
        <View
          style={[
            styles.search,
            { backgroundColor: colors.input, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Rechercher un e-mail…"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
          {searchInput.length > 0 ? (
            <Pressable onPress={() => setSearchInput("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        {/* Tri */}
        <View style={styles.sortRow}>
          <SortTab
            label="Récents"
            icon="clock"
            active={sort === "recent"}
            onPress={() => {
              if (sort !== "recent") {
                tap();
                setSort("recent");
              }
            }}
          />
          <SortTab
            label="Tri IA"
            icon="zap"
            active={sort === "smart"}
            onPress={() => {
              if (sort !== "smart") {
                tap();
                setSort("smart");
              }
            }}
          />
        </View>

        {/* Filtres : priorité + catégories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <FilterChip
            label="Tous"
            active={allActive}
            onPress={() => {
              tap();
              setPriority(null);
              setCategoryId(null);
            }}
          />
          <FilterChip
            label="Urgents"
            tone="danger"
            active={priority === "urgent"}
            onPress={() => {
              tap();
              setCategoryId(null);
              setPriority(priority === "urgent" ? null : "urgent");
            }}
          />
          <FilterChip
            label="Importants"
            tone="warning"
            active={priority === "moyen"}
            onPress={() => {
              tap();
              setCategoryId(null);
              setPriority(priority === "moyen" ? null : "moyen");
            }}
          />
          {categories.length > 0 ? (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          ) : null}
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={categoryId === c.id}
              onPress={() => {
                tap();
                setPriority(null);
                setCategoryId(categoryId === c.id ? null : c.id);
              }}
            />
          ))}
        </ScrollView>
      </View>

      {query.isLoading ? (
        <SkeletonList />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          subtitle="Impossible de charger vos e-mails. Vérifiez votre connexion."
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : emails.length === 0 ? (
        <CenterState
          icon="inbox"
          title={allActive && !q ? "Boîte vide" : "Aucun résultat"}
          subtitle={
            allActive && !q
              ? "Aucun e-mail pour le moment. Tout est traité !"
              : "Aucun e-mail ne correspond à ce filtre."
          }
        />
      ) : (
        <FlatList
          data={emails}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <EmailRow email={item} onPress={() => openEmail(item)} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

function SortTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.sortTab,
        {
          backgroundColor: active ? colors.chipActiveBg : "transparent",
          borderColor: active ? colors.chipActiveBorder : colors.border,
        },
      ]}
    >
      <Feather
        name={icon}
        size={13}
        color={active ? colors.primary : colors.mutedForeground}
      />
      <Text
        style={[
          styles.sortTabText,
          { color: active ? colors.primary : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: "danger" | "warning";
}) {
  const colors = useColors();
  const activeColor =
    tone === "danger"
      ? colors.destructive
      : tone === "warning"
        ? colors.warning
        : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? `${activeColor}26` : colors.chipBg,
          borderColor: active ? `${activeColor}66` : colors.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.chipText,
          {
            color: active ? activeColor : colors.mutedForeground,
            fontFamily: active ? "Inter_500Medium" : "Inter_400Regular",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { width: 122, height: 30 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontFamily: "Inter_400Regular", height: "100%" },
  sortRow: { flexDirection: "row", gap: 8 },
  sortTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  sortTabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  filters: { flexDirection: "row", gap: 7, paddingRight: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 12.5, maxWidth: 150 },
  divider: { width: 1, height: 20, marginHorizontal: 3, alignSelf: "center" },
});
