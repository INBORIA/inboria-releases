import { Tabs, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const logoSource = require("@/assets/images/inboria-logo.png");

function LogoIcon() {
  return (
    <Image source={logoSource} style={hStyles.logo} resizeMode="contain" />
  );
}

function HeaderProfileButton() {
  const colors = useColors();
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useGetProfile({
    query: { enabled: !!session, queryKey: getGetProfileQueryKey() },
  });
  const name = profile?.fullName || session?.user?.email || "";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "?";
  return (
    <Pressable
      onPress={() => router.push("/parametres")}
      hitSlop={8}
      style={({ pressed }) => [
        hStyles.avatar,
        { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Profil"
    >
      <Text style={[hStyles.avatarText, { color: colors.primaryForeground }]}>
        {initials}
      </Text>
    </Pressable>
  );
}

const hStyles = StyleSheet.create({
  logo: { width: 120, height: 40, marginLeft: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});

export default function TabLayout() {
  const colors = useColors();
  const { t } = useTranslation();
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  const tabBarHeight = isWeb ? 84 : Math.max(64, 54 + insets.bottom);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
        headerLeft: () => <LogoIcon />,
        headerRight: () => <HeaderProfileButton />,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: isWeb ? 8 : insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.inbox"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="email-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bilan"
        options={{
          title: t("tabs.bilan"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: t("agenda.title"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("tabs.tasks"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="check-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: t("tabs.projects"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.menu"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
