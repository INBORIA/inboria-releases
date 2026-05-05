import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGetProfile } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/i18n";

const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "pl", label: "Polski" },
  { code: "ro", label: "Română" },
  { code: "sv", label: "Svenska" },
  { code: "da", label: "Dansk" },
  { code: "fi", label: "Suomi" },
  { code: "hu", label: "Magyar" },
  { code: "cs", label: "Čeština" },
  { code: "tr", label: "Türkçe" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "th", label: "ไทย" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "el", label: "Ελληνικά" },
  { code: "uk", label: "Українська" },
  { code: "et", label: "Eesti" },
  { code: "zh", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "lt", label: "Lietuvių" },
  { code: "sr", label: "Српски" },
  { code: "ru", label: "Русский" },
  { code: "he", label: "עברית" },
  { code: "ar", label: "العربية" },
];

export default function MenuScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { data: profile } = useGetProfile();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isWeb = Platform.OS === "web";
  const [showLangPicker, setShowLangPicker] = useState(false);

  const rawLangCode = (i18n.resolvedLanguage || i18n.language || "fr");
  const lowerFullLang = rawLangCode.toLowerCase();
  const normalizedLangCode = (lowerFullLang === "zh-tw" || lowerFullLang === "zh_tw" || lowerFullLang === "zh-hant" || lowerFullLang === "zh-hk") ? "zh-TW" : rawLangCode.substring(0, 2);
  const currentLang = LANGUAGES.find((l) => l.code === normalizedLangCode) || LANGUAGES[0];

  const MENU_ITEMS = [
    {
      key: "archives",
      label: t("settings.archives"),
      desc: t("settings.archivesDesc"),
      icon: "archive-outline" as const,
      route: "/archives",
      color: "#6366f1",
    },
    {
      key: "categories",
      label: t("settings.categories"),
      desc: t("settings.categoriesDesc"),
      icon: "tag-outline" as const,
      route: "/categories",
      color: "#22c55e",
    },
    {
      key: "abonnement",
      label: t("settings.subscription"),
      desc: t("settings.subscriptionDesc"),
      icon: "credit-card-outline" as const,
      route: "/abonnement",
      color: "#f59e0b",
    },
    {
      key: "parametres",
      label: t("settings.parameters"),
      desc: t("settings.parametersDesc"),
      icon: "cog-outline" as const,
      route: "/parametres",
      color: "#8b5cf6",
    },
  ];

  const quotaPercent = profile
    ? Math.min(100, (profile.emailsUsed / Math.max(1, profile.emailsQuota)) * 100)
    : 0;

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: isWeb ? 75 : 8, paddingBottom: isWeb ? 84 : 100 }]}
    >
      <View style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
          <MaterialCommunityIcons name="account-outline" size={24} color={colors.primary} />
        </View>
        <View style={s.profileInfo}>
          <Text style={[s.profileName, { color: colors.foreground }]}>
            {profile?.fullName || "..."}
          </Text>
          <Text style={[s.profileEmail, { color: colors.mutedForeground }]}>
            {profile?.email || "..."}
          </Text>
          <View style={[s.planBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[s.planText, { color: colors.primary }]}>
              {profile?.plan?.charAt(0).toUpperCase() + (profile?.plan?.slice(1) || "") || t("common.free")}
            </Text>
          </View>
        </View>
      </View>

      <View style={[s.quotaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.quotaHeader}>
          <View style={s.quotaLeft}>
            <MaterialCommunityIcons name="email-check-outline" size={16} color={colors.primary} />
            <Text style={[s.quotaLabel, { color: colors.mutedForeground }]}>{t("settings.aiQuota")}</Text>
          </View>
          <Text style={[s.quotaValue, { color: colors.foreground }]}>
            {profile?.emailsUsed ?? 0} / {profile?.emailsQuota ?? 0}
          </Text>
        </View>
        <View style={[s.progressBg, { backgroundColor: colors.foreground + "15" }]}>
          <View
            style={[
              s.progressFill,
              {
                backgroundColor: quotaPercent > 80 ? "#ef4444" : colors.primary,
                width: `${quotaPercent}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={[s.langCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={s.langRow}
          onPress={() => setShowLangPicker(!showLangPicker)}
          activeOpacity={0.7}
        >
          <View style={[s.menuIcon, { backgroundColor: "#3b82f615" }]}>
            <MaterialCommunityIcons name="translate" size={20} color="#3b82f6" />
          </View>
          <View style={s.menuText}>
            <Text style={[s.menuLabel, { color: colors.foreground }]}>{t("settings.language")}</Text>
            <Text style={[s.menuDesc, { color: colors.mutedForeground }]}>{t("settings.languageDesc")}</Text>
          </View>
          <View style={s.langCurrent}>
            
            <Text style={[s.langCurrentLabel, { color: colors.primary }]}>{currentLang.label}</Text>
            <MaterialCommunityIcons
              name={showLangPicker ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.mutedForeground + "60"}
            />
          </View>
        </TouchableOpacity>
        {showLangPicker && (
          <View style={[s.langOptions, { borderTopColor: colors.border }]}>
            {LANGUAGES.map((lang) => {
              const isActive = currentLang.code === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    s.langOption,
                    isActive && { backgroundColor: colors.primary + "10" },
                  ]}
                  onPress={() => {
                    changeLanguage(lang.code);
                    setShowLangPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  
                  <Text style={[s.langOptionLabel, { color: isActive ? colors.primary : colors.foreground }]}>
                    {lang.label}
                  </Text>
                  {isActive && <MaterialCommunityIcons name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={s.menuSection}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[s.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={[s.menuIcon, { backgroundColor: item.color + "15" }]}>
              <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={s.menuText}>
              <Text style={[s.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[s.menuDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground + "60"} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[s.logoutBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}
        onPress={signOut}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="logout" size={18} color={colors.destructive} />
        <Text style={[s.logoutLabel, { color: colors.destructive }]}>{t("settings.logout")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start", marginTop: 6 },
  planText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  quotaCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  quotaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quotaLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  quotaLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  quotaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },

  menuSection: { gap: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  menuText: { flex: 1, minWidth: 0 },
  menuLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  langCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  langCurrent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  langFlag: { fontSize: 18 },
  langCurrentLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  langOptions: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  langOptionLabel: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
