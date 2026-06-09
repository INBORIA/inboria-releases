import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmailRow } from "@/components/EmailRow";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { listEmails, type EmailListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const [sort, setSort] = useState<"smart" | "recent">("smart");

  const query = useQuery({
    queryKey: ["emails", "inbox", sort],
    queryFn: () => listEmails({ sort, status: "inbox", limit: 40 }),
  });

  const emails = query.data?.emails ?? [];
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  function openEmail(email: EmailListItem) {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: "/email/[id]", params: { id: String(email.id) } });
  }

  function toggleSort(next: "smart" | "recent") {
    if (next === sort) return;
    if (Platform.OS !== "web") {
      void Haptics.selectionAsync();
    }
    setSort(next);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.brand, { color: colors.foreground }]}>
            Inboria
          </Text>
          <Pressable
            onPress={() => signOut()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: pressed ? colors.surfaceHover : "transparent",
              },
            ]}
          >
            <Feather name="log-out" size={19} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <SortTab
            label="Tri IA"
            icon="zap"
            active={sort === "smart"}
            onPress={() => toggleSort("smart")}
          />
          <SortTab
            label="Récents"
            icon="clock"
            active={sort === "recent"}
            onPress={() => toggleSort("recent")}
          />
        </View>
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
          title="Boîte vide"
          subtitle="Aucun e-mail pour le moment. Tout est traité !"
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
        styles.tab,
        {
          backgroundColor: active ? "rgba(139,92,246,0.15)" : "transparent",
          borderColor: active ? "rgba(139,92,246,0.35)" : colors.border,
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
          styles.tabText,
          { color: active ? colors.primary : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
