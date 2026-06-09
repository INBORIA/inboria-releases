import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

type Item = { icon: keyof typeof Feather.glyphMap; label: string; route: string };

const ITEMS: Item[] = [
  { icon: "inbox", label: "Réception", route: "/" },
  { icon: "send", label: "Envoyés", route: "/sent" },
  { icon: "clock", label: "Programmés", route: "/scheduled" },
  { icon: "folder", label: "Mes dossiers", route: "/folders" },
  { icon: "archive", label: "Archives", route: "/archive" },
  { icon: "trash-2", label: "Corbeille", route: "/trash" },
  { icon: "users", label: "Contacts", route: "/contacts" },
  { icon: "settings", label: "Paramètres", route: "/settings" },
];

export function AppMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  function go(route: string) {
    onClose();
    setTimeout(() => router.push(route as never), 10);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.panel,
            {
              backgroundColor: colors.card,
              paddingTop: topPad + 10,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Image
            source={require("../assets/images/inboria-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {ITEMS.map((it) => (
              <Pressable
                key={it.label}
                onPress={() => go(it.route)}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed
                      ? colors.surfaceHover
                      : "transparent",
                  },
                ]}
              >
                <Feather name={it.icon} size={19} color={colors.mutedForeground} />
                <Text style={[styles.itemText, { color: colors.foreground }]}>
                  {it.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => {
              onClose();
              signOut();
            }}
            style={({ pressed }) => [
              styles.item,
              styles.signOut,
              {
                backgroundColor: pressed ? colors.surfaceHover : "transparent",
                borderTopColor: colors.border,
              },
            ]}
          >
            <Feather name="log-out" size={19} color={colors.destructive} />
            <Text style={[styles.itemText, { color: colors.destructive }]}>
              Déconnexion
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row" },
  panel: { width: 290, maxWidth: "85%", paddingHorizontal: 14, flex: 1 },
  logo: { width: 130, height: 32, marginLeft: 8, marginBottom: 18 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  itemText: { fontSize: 15.5, fontFamily: "Inter_500Medium" },
  signOut: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    borderRadius: 0,
    paddingTop: 16,
  },
});
