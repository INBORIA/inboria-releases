import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGetProfile } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const plans = [
  {
    id: "essai",
    name: "Essai",
    price: "gratuit",
    quota: 100,
    description: "100 emails offerts pour decouvrir NCV Mail",
    features: [
      "100 emails offerts (usage unique)",
      "3 rubriques personnalisees",
      "Support par email",
      "Brouillons IA inclus",
    ],
    icon: "check" as const,
  },
  {
    id: "solo",
    name: "Solo",
    price: "9",
    quota: 3000,
    description: "Pour les independants",
    features: [
      "3 000 emails par mois",
      "Rubriques illimitees",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Extraction automatique des taches",
      "Support prioritaire",
    ],
    icon: "lightning-bolt" as const,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    quota: 10000,
    description: "Ideal pour les professionnels",
    features: [
      "10 000 emails par mois",
      "Rubriques illimitees",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Statistiques detaillees",
      "Support prioritaire",
    ],
    icon: "lightning-bolt-outline" as const,
  },
  {
    id: "business",
    name: "Business",
    price: "9",
    quota: 10000,
    description: "Pour les equipes",
    features: [
      "10 000 emails / siege / mois",
      "Tout du plan Pro inclus",
      "Minimum 3 sieges, jusqu'a 50",
      "Boites partagees",
      "Assignation de taches",
      "API dediee",
    ],
    icon: "account-group-outline" as const,
  },
];

export default function AbonnementScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: profile } = useGetProfile();
  const isWeb = Platform.OS === "web";

  const quotaPercent = profile
    ? Math.min(100, (profile.emailsUsed / Math.max(1, profile.emailsQuota)) * 100)
    : 0;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.mutedForeground} />
          <Text style={[s.backText, { color: colors.mutedForeground }]}>Retour</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: isWeb ? 84 : 100 }]}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>Abonnement</Text>
        <Text style={[s.pageSubtitle, { color: colors.mutedForeground }]}>
          Gerez votre plan et vos quotas.
        </Text>

        {profile && (
          <View style={[s.currentPlan, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.planRow}>
              <Text style={[s.planLabel, { color: colors.foreground }]}>Plan actuel</Text>
              <View style={[s.planBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[s.planBadgeText, { color: colors.primary }]}>
                  {profile.plan?.charAt(0).toUpperCase() + profile.plan?.slice(1) || "Essai"}
                </Text>
              </View>
            </View>

            <View style={s.quotaSection}>
              <View style={s.quotaHeader}>
                <Text style={[s.quotaLabel, { color: colors.mutedForeground }]}>Consommation IA</Text>
                <Text style={[s.quotaValue, { color: colors.foreground }]}>
                  {profile.emailsUsed} / {profile.emailsQuota}
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
              {quotaPercent > 80 && (
                <Text style={[s.quotaWarn, { color: "#ef4444" }]}>
                  Attention : vous approchez de votre limite mensuelle.
                </Text>
              )}
            </View>
          </View>
        )}

        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Tous les plans</Text>

        {plans.map((plan) => {
          const isCurrent = profile?.plan === plan.id;
          return (
            <View
              key={plan.id}
              style={[
                s.planCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isCurrent ? colors.primary : colors.border,
                },
              ]}
            >
              {isCurrent && (
                <View style={[s.currentTag, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[s.currentTagText, { color: colors.primary }]}>Plan actuel</Text>
                </View>
              )}
              <View style={s.planCardHeader}>
                <View style={[s.planIcon, { backgroundColor: isCurrent ? colors.primary + "15" : colors.foreground + "08" }]}>
                  <MaterialCommunityIcons
                    name={plan.icon}
                    size={20}
                    color={isCurrent ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.planName, { color: colors.foreground }]}>{plan.name}</Text>
                  <Text style={[s.planDesc, { color: colors.mutedForeground }]}>{plan.description}</Text>
                </View>
                <View>
                  <Text style={[s.planPrice, { color: colors.foreground }]}>{plan.id === "essai" ? "Gratuit" : `${plan.price}€`}</Text>
                  {plan.id !== "essai" && <Text style={[s.planPeriod, { color: colors.mutedForeground }]}>/mois</Text>}
                </View>
              </View>

              <View style={s.featuresList}>
                {plan.features.map((feature, i) => (
                  <View key={i} style={s.featureRow}>
                    <MaterialCommunityIcons
                      name="check"
                      size={14}
                      color={isCurrent ? colors.primary : "#22c55e"}
                    />
                    <Text style={[s.featureText, { color: colors.mutedForeground }]}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.infoIcon, { backgroundColor: "#f59e0b15" }]}>
            <MaterialCommunityIcons name="credit-card-outline" size={16} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: colors.foreground }]}>Depassement de quota</Text>
            <Text style={[s.infoDesc, { color: colors.mutedForeground }]}>
              Facturation automatique Pay-as-you-go. Notification a 80% du quota.
            </Text>
          </View>
        </View>

        <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.infoIcon, { backgroundColor: "#3b82f615" }]}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#3b82f6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: colors.foreground }]}>Sans engagement</Text>
            <Text style={[s.infoDesc, { color: colors.mutedForeground }]}>
              Changez de plan ou annulez a tout moment.
            </Text>
          </View>
        </View>

        <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.infoIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: colors.foreground }]}>Securite RGPD</Text>
            <Text style={[s.infoDesc, { color: colors.mutedForeground }]}>
              Vos emails ne sont jamais stockes pour entrainer nos modeles. Donnees hebergees en Europe.
            </Text>
          </View>
        </View>

        <Text style={[s.footnote, { color: colors.mutedForeground }]}>
          Pour changer de plan, rendez-vous sur l'application web NCV Mail.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  scroll: { padding: 16, gap: 12 },
  pageTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  pageSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },

  currentPlan: { padding: 16, borderRadius: 12, borderWidth: 1 },
  planRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  planLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  planBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  planBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  quotaSection: { gap: 6 },
  quotaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quotaLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  quotaValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  quotaWarn: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },

  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 8 },

  planCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  currentTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-end", marginBottom: 4 },
  currentTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  planCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  planIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  planName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  planDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  planPrice: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "right" },
  planPeriod: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },

  featuresList: { gap: 6 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  featureText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  infoDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  footnote: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
});
