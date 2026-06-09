import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CenterState, SkeletonList } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import { searchContacts } from "@/lib/api";

export default function ContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const query = useQuery({
    queryKey: ["contacts", q],
    queryFn: () => searchContacts(q),
    enabled: q.length >= 1,
  });
  const contacts = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Contacts" />
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.input, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Rechercher un contact…"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {input.length > 0 ? (
            <Pressable onPress={() => setInput("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {q.length < 1 ? (
        <CenterState
          icon="users"
          title="Recherchez un contact"
          subtitle="Tapez un nom ou une adresse e-mail."
        />
      ) : query.isLoading ? (
        <SkeletonList count={6} />
      ) : query.isError ? (
        <CenterState
          icon="wifi-off"
          title="Connexion impossible"
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : contacts.length === 0 ? (
        <CenterState
          icon="users"
          title="Aucun contact"
          subtitle="Aucun résultat pour cette recherche."
        />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.email}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/compose", params: { to: item.email } })
              }
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: colors.mailBorder,
                  backgroundColor: pressed ? colors.surfaceHover : "transparent",
                },
              ]}
            >
              <Avatar name={item.displayName} email={item.email} size={40} />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: colors.foreground }]}
                >
                  {item.displayName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.email, { color: colors.mailMuted }]}
                >
                  {item.email}
                </Text>
              </View>
              <Feather name="edit-3" size={17} color={colors.faint} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 14, paddingVertical: 10 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
    height: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 15, fontFamily: "Inter_500Medium" },
  email: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
});
