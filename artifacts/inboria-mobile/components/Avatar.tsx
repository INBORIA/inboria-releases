import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

function initialOf(name: string | null | undefined, fallback: string): string {
  const source = (name || fallback || "?").trim();
  return source.charAt(0).toUpperCase() || "?";
}

export function Avatar({
  name,
  email,
  size = 40,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const colors = useColors();
  const letter = initialOf(name, email || "?");

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.avatarBg,
          borderColor: colors.avatarBorder,
        },
      ]}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: size * 0.4,
          fontFamily: "Inter_600SemiBold",
        }}
      >
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
