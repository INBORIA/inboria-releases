import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const logoSource = require("@/assets/images/logo-ncv.webp");

function LogoBrand() {
  const colors = useColors();
  return (
    <View style={hStyles.brand}>
      <Image source={logoSource} style={hStyles.logo} resizeMode="contain" />
      <Text style={[hStyles.appName, { color: colors.foreground }]}>NCV Mail</Text>
    </View>
  );
}

const hStyles = StyleSheet.create({
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 4,
  },
  logo: { width: 26, height: 26 },
  appName: { fontSize: 15, fontFamily: "Inter_700Bold" },
});

export default function TabLayout() {
  const colors = useColors();
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
        headerLeft: () => <LogoBrand />,
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
          title: "Reception",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="email-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bilan"
        options={{
          title: "Bilan",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Taches",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="check-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projets",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
