import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGenerateDailySummary } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

export default function BilanScreen() {
  const colors = useColors();
  const { t, i18n } = useTranslation();
  const generateSummary = useGenerateDailySummary();
  const [summaryData, setSummaryData] = useState<any>(null);
  const isWeb = Platform.OS === "web";
  const currentLang = (i18n.resolvedLanguage || i18n.language || "fr").substring(0, 2);

  const fetchSummary = () => {
    generateSummary.mutate(
      { data: { language: currentLang } },
      { onSuccess: (data) => setSummaryData(data) }
    );
  };

  useEffect(() => {
    fetchSummary();
  }, [currentLang]);

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: isWeb ? 75 : 8, paddingBottom: isWeb ? 84 : 100 }]}
    >
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>
            {t("bilan.title")}
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {t("bilan.subtitle")}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.refreshBtn, { backgroundColor: colors.primary }]}
          onPress={fetchSummary}
          disabled={generateSummary.isPending}
          activeOpacity={0.7}
        >
          {generateSummary.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="refresh" size={14} color="#fff" />
              <Text style={s.refreshLabel}>{t("bilan.regenerate")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {generateSummary.isPending && !summaryData ? (
        <View style={[s.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadingTitle, { color: colors.foreground }]}>
            {t("bilan.analyzing")}
          </Text>
          <Text style={[s.loadingDesc, { color: colors.mutedForeground }]}>
            {t("bilan.analyzingDesc")}
          </Text>
        </View>
      ) : !summaryData ? (
        <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="chart-bar" size={48} color={colors.mutedForeground + "40"} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>{t("bilan.noBilan")}</Text>
          <Text style={[s.emptyDesc, { color: colors.mutedForeground }]}>
            {t("bilan.noBilanDesc")}
          </Text>
          <TouchableOpacity
            style={[s.generateBtn, { backgroundColor: colors.primary }]}
            onPress={fetchSummary}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={14} color="#fff" />
            <Text style={s.generateLabel}>{t("bilan.generate")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={s.statsRow}>
            <View style={[s.scoreCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
              <Text style={[s.statLabel, { color: colors.primary }]}>{t("bilan.serenityScore")}</Text>
              <View style={s.scoreRow}>
                <Text style={[s.scoreValue, { color: colors.foreground }]}>{summaryData.score}</Text>
                <Text style={[s.scoreMax, { color: colors.mutedForeground }]}>/100</Text>
              </View>
              <View style={[s.progressBg, { backgroundColor: colors.foreground + "15" }]}>
                <View style={[s.progressFill, { backgroundColor: colors.primary, width: `${summaryData.score}%` }]} />
              </View>
            </View>

            <View style={s.miniStatsCol}>
              <View style={[s.miniStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.miniIcon, { backgroundColor: "#ef444415" }]}>
                  <MaterialCommunityIcons name="alert-outline" size={16} color="#ef4444" />
                </View>
                <View>
                  <Text style={[s.miniCount, { color: colors.foreground }]}>{summaryData.stats.urgent}</Text>
                  <Text style={[s.miniLabel, { color: colors.mutedForeground }]}>{t("bilan.urgencies")}</Text>
                </View>
              </View>
              <View style={[s.miniStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.miniIcon, { backgroundColor: colors.primary + "15" }]}>
                  <MaterialCommunityIcons name="checkbox-marked-outline" size={16} color={colors.primary} />
                </View>
                <View>
                  <Text style={[s.miniCount, { color: colors.foreground }]}>{summaryData.stats.pending}</Text>
                  <Text style={[s.miniLabel, { color: colors.mutedForeground }]}>{t("bilan.tasks")}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[s.overviewCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t("bilan.overview")}</Text>
            <Text style={[s.overviewText, { color: colors.mutedForeground }]}>
              {summaryData.summary}
            </Text>
          </View>

          {summaryData.keyEmails && summaryData.keyEmails.length > 0 && (
            <View>
              <View style={s.sectionHeader}>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t("bilan.keyEmails")}</Text>
              </View>
              {summaryData.keyEmails.map((email: any) => (
                <View key={email.id} style={[s.emailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.emailHeader}>
                    <Text style={[s.emailSender, { color: colors.foreground }]}>{email.sender}</Text>
                    <View style={[s.priorityBadge, {
                      backgroundColor: email.priority === "urgent" ? "#ef444420" : "#f59e0b20"
                    }]}>
                      <Text style={[s.priorityText, {
                        color: email.priority === "urgent" ? "#ef4444" : "#f59e0b"
                      }]}>
                        {email.priority === "urgent" ? t("bilan.urgent") : t("bilan.important")}
                      </Text>
                    </View>
                  </View>
                  <Text style={[s.emailSubject, { color: colors.mutedForeground }]}>{email.subject}</Text>
                  <View style={[s.emailSummaryBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[s.emailSummary, { color: colors.mutedForeground }]}>{email.summary}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {summaryData.advice && (
            <View>
              <View style={s.sectionHeader}>
                <MaterialCommunityIcons name="trending-up" size={16} color={colors.primary} />
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t("bilan.dailyAdvice")}</Text>
              </View>
              <View style={[s.adviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.adviceIcon, { backgroundColor: colors.primary + "15" }]}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color={colors.primary} />
                </View>
                <Text style={[s.adviceText, { color: colors.mutedForeground }]}>
                  "{summaryData.advice}"
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshLabel: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  loadingCard: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  loadingTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  loadingDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  emptyCard: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  generateLabel: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  statsRow: { flexDirection: "row", gap: 10 },
  scoreCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  scoreValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  scoreMax: { fontSize: 14, fontFamily: "Inter_400Regular", marginLeft: 2 },
  progressBg: { height: 4, borderRadius: 2, marginTop: 8, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },

  miniStatsCol: { flex: 1, gap: 10 },
  miniStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  miniIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  miniCount: { fontSize: 20, fontFamily: "Inter_700Bold" },
  miniLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  overviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  overviewText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, marginTop: 6 },

  emailCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  emailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  emailSender: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  emailSubject: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 6 },
  emailSummaryBox: { padding: 10, borderRadius: 8, borderWidth: 1 },
  emailSummary: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  adviceCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  adviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  adviceText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, fontStyle: "italic" },
});
