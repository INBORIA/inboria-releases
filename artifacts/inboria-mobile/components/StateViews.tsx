import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function SkeletonList({ count = 8 }: { count?: number }) {
  const colors = useColors();
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.skelRow, { borderBottomColor: colors.border }]}
        >
          <View
            style={[styles.skelAvatar, { backgroundColor: colors.secondary }]}
          />
          <View style={styles.skelBody}>
            <View
              style={[
                styles.skelLine,
                { backgroundColor: colors.secondary, width: "55%" },
              ]}
            />
            <View
              style={[
                styles.skelLine,
                { backgroundColor: colors.secondary, width: "80%" },
              ]}
            />
            <View
              style={[
                styles.skelLine,
                { backgroundColor: colors.secondary, width: "40%" },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function CenterState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={26} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceHover : colors.card,
            },
          ]}
        >
          <Feather name="refresh-cw" size={14} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FullLoader() {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  skelRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skelAvatar: { width: 42, height: 42, borderRadius: 21 },
  skelBody: { flex: 1, gap: 8, justifyContent: "center" },
  skelLine: { height: 11, borderRadius: 6 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  actionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
