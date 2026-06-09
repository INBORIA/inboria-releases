import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View
      style={[
        styles.header,
        { paddingTop: topPad + 6, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={10}
        accessibilityLabel="Retour"
        style={({ pressed }) => [
          styles.iconBtn,
          { backgroundColor: pressed ? colors.surfaceHover : "transparent" },
        ]}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={[styles.title, { color: colors.foreground }]}
      >
        {title}
      </Text>
      <View style={styles.iconBtn}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "center",
  },
});
