import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useGetEmail,
  useUpdateEmail,
  useDeleteEmail,
  useSendEmail,
  useGenerateDraft,
  useListCategories,
  useListProjects,
  useGetProfile,
  getListEmailsQueryKey,
  getGetEmailQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cleanEmailBody } from "@/utils/cleanEmailBody";

let Haptics: typeof import("expo-haptics") | null = null;
try {
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

const PRIORITY_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  urgent: { bg: "#ef444420", fg: "#ef4444", label: "Urgent" },
  moyen: { bg: "#f59e0b20", fg: "#f59e0b", label: "Moyen" },
  faible: { bg: "#22c55e20", fg: "#22c55e", label: "Faible" },
};

const PRIORITIES = ["urgent", "moyen", "faible"] as const;

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data: email, isLoading } = useGetEmail(Number(id));
  const { data: profile } = useGetProfile();
  const { data: categories } = useListCategories();
  const { data: projects } = useListProjects();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const sendEmail = useSendEmail();
  const generateDraft = useGenerateDraft();

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const hapticLight = () => {
    if (Platform.OS !== "web" && Haptics) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  };

  const hapticMedium = () => {
    if (Platform.OS !== "web" && Haptics) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEmailQueryKey(Number(id)) });
  };

  const handleMarkRead = () => {
    hapticLight();
    updateEmail.mutate(
      { id: Number(id), data: { status: "read" } },
      { onSuccess: invalidateAll }
    );
  };

  const handleArchive = () => {
    hapticMedium();
    updateEmail.mutate(
      { id: Number(id), data: { status: "archived" } },
      { onSuccess: () => { invalidateAll(); router.back(); } }
    );
  };

  const handleDelete = () => {
    const doDelete = () => {
      hapticMedium();
      deleteEmail.mutate(
        { id: Number(id) },
        { onSuccess: () => { invalidateAll(); router.back(); } }
      );
    };

    if (Platform.OS === "web") {
      if (confirm("Supprimer cet email ?")) doDelete();
    } else {
      Alert.alert("Supprimer", "Supprimer cet email ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleReplyOpen = () => {
    if (!email) return;
    setReplyTo(email.senderEmail || "");
    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setReplyText(profile?.signature ? `\n\n${profile.signature}` : "");
    setReplyOpen(true);
  };

  const handleAiDraft = () => {
    if (!email) return;
    setReplyTo(email.senderEmail || "");
    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setReplyOpen(true);
    generateDraft.mutate(
      { data: { emailId: Number(id) } },
      { onSuccess: (res: any) => { setReplyText(res.draft || ""); } }
    );
  };

  const handleSendReply = () => {
    if (!replyTo.trim() || !replySubject.trim() || !replyText.trim()) return;
    hapticMedium();
    sendEmail.mutate(
      { data: { to: replyTo, subject: replySubject, body: replyText, replyToEmailId: Number(id) } },
      {
        onSuccess: () => {
          setReplyOpen(false);
          setReplyTo("");
          setReplySubject("");
          setReplyText("");
          invalidateAll();
        },
      }
    );
  };

  const handleUpdatePriority = (priority: string) => {
    hapticLight();
    updateEmail.mutate(
      { id: Number(id), data: { priority } },
      { onSuccess: invalidateAll }
    );
    setShowPriorityPicker(false);
  };

  const handleUpdateCategory = (categoryId: string) => {
    hapticLight();
    const data = categoryId === "none" ? { categoryId: null } : { categoryId: Number(categoryId) };
    updateEmail.mutate(
      { id: Number(id), data: data as any },
      { onSuccess: invalidateAll }
    );
    setShowCategoryPicker(false);
  };

  const handleUpdateProject = (projectId: string) => {
    hapticLight();
    const data = projectId === "none" ? { projectId: null } : { projectId };
    updateEmail.mutate(
      { id: Number(id), data: data as any },
      { onSuccess: invalidateAll }
    );
    setShowProjectPicker(false);
  };

  const formatFullDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isLoading) {
    return (
      <View style={[s.full, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!email) {
    return (
      <View style={[s.full, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.mutedForeground + "40"} />
        <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>Email introuvable</Text>
      </View>
    );
  }

  const pConfig = PRIORITY_CONFIG[email.priority ?? "faible"] || PRIORITY_CONFIG.faible;
  const cleanedBody = useMemo(() => cleanEmailBody(email.body), [email.body]);
  const catList = Array.isArray(categories) ? categories : [];
  const projList = Array.isArray(projects) ? projects : [];

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: isWeb ? 34 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.subjectRow}>
            <Text style={[s.subjectText, { color: colors.foreground }]}>{email.subject}</Text>
            <View style={[s.priorityBadge, { backgroundColor: pConfig.bg }]}>
              <Text style={[s.priorityLabel, { color: pConfig.fg }]}>{pConfig.label}</Text>
            </View>
          </View>

          <View style={s.senderRow}>
            <View style={[s.avatar, { backgroundColor: colors.primary + "25" }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>
                {(email.sender || "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={s.senderInfo}>
              <Text style={[s.senderName, { color: colors.foreground }]}>{email.sender}</Text>
              {email.senderEmail ? (
                <Text style={[s.senderEmail, { color: colors.mutedForeground }]}>
                  {email.senderEmail}
                </Text>
              ) : null}
            </View>
            <Text style={[s.dateText, { color: colors.mutedForeground }]}>
              {formatFullDate(email.createdAt)}
            </Text>
          </View>
        </View>

        {email.summary ? (
          <View
            style={[
              s.summaryCard,
              { backgroundColor: colors.primary + "0A", borderColor: colors.primary + "20" },
            ]}
          >
            <View style={s.summaryHeader}>
              <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.primary} />
              <Text style={[s.summaryTitle, { color: colors.primary }]}>Resume IA</Text>
            </View>
            <Text style={[s.summaryBody, { color: colors.mutedForeground }]}>
              {email.summary}
            </Text>
          </View>
        ) : null}

        {(email.categoryName || email.projectReference) ? (
          <View style={s.chipRow}>
            {email.categoryName ? (
              <View style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="tag-outline" size={12} color={colors.mutedForeground} />
                <Text style={[s.chipText, { color: colors.mutedForeground }]}>
                  {email.categoryName}
                </Text>
              </View>
            ) : null}
            {email.projectReference ? (
              <View
                style={[s.chip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
              >
                <MaterialCommunityIcons name="folder-outline" size={12} color={colors.primary} />
                <Text style={[s.chipText, { color: colors.primary }]}>
                  {email.projectReference}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[s.bodyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.bodyText, { color: colors.foreground + "CC" }]}>
            {cleanedBody || "(Aucun contenu disponible)"}
          </Text>
        </View>

        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleReplyOpen}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="reply" size={16} color="#fff" />
            <Text style={[s.actionLabel, { color: "#fff" }]}>Repondre</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
            onPress={handleAiDraft}
            activeOpacity={0.7}
            disabled={generateDraft.isPending}
          >
            {generateDraft.isPending ? (
              <ActivityIndicator size={14} color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="auto-fix" size={16} color={colors.primary} />
            )}
            <Text style={[s.actionLabel, { color: colors.primary }]}>
              {generateDraft.isPending ? "Generation..." : "Reponse IA"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[s.actionsRow, { marginTop: 8 }]}>
          {email.status === "unread" && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleMarkRead}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
              <Text style={[s.actionLabel, { color: colors.primary }]}>Lu</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleArchive}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="archive-outline" size={16} color={colors.mutedForeground} />
            <Text style={[s.actionLabel, { color: colors.mutedForeground }]}>Archiver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: "#ef444430" }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" />
            <Text style={[s.actionLabel, { color: "#ef4444" }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={s.settingRow}
            onPress={() => setShowPriorityPicker(!showPriorityPicker)}
            activeOpacity={0.7}
          >
            <Text style={[s.settingLabel, { color: colors.mutedForeground }]}>Priorite</Text>
            <View style={s.settingValueRow}>
              <Text style={[s.settingValue, { color: pConfig.fg }]}>{pConfig.label}</Text>
              <MaterialCommunityIcons
                name={showPriorityPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </View>
          </TouchableOpacity>
          {showPriorityPicker && (
            <View style={[s.pickerOptions, { borderColor: colors.border }]}>
              {PRIORITIES.map((p) => {
                const pc = PRIORITY_CONFIG[p];
                const isActive = email.priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[s.pickerOption, isActive && { backgroundColor: pc.bg }]}
                    onPress={() => handleUpdatePriority(p)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.priorityDot, { backgroundColor: pc.fg }]} />
                    <Text style={[s.pickerOptionText, { color: isActive ? pc.fg : colors.foreground }]}>
                      {pc.label}
                    </Text>
                    {isActive && <MaterialCommunityIcons name="check" size={14} color={pc.fg} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={[s.settingDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={s.settingRow}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            activeOpacity={0.7}
          >
            <Text style={[s.settingLabel, { color: colors.mutedForeground }]}>Categorie</Text>
            <View style={s.settingValueRow}>
              <Text style={[s.settingValue, { color: colors.foreground }]}>
                {email.categoryName || "Non classe"}
              </Text>
              <MaterialCommunityIcons
                name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </View>
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={[s.pickerOptions, { borderColor: colors.border }]}>
              <TouchableOpacity
                style={[s.pickerOption, !email.categoryId && { backgroundColor: colors.primary + "10" }]}
                onPress={() => handleUpdateCategory("none")}
                activeOpacity={0.7}
              >
                <Text style={[s.pickerOptionText, { color: !email.categoryId ? colors.primary : colors.foreground }]}>
                  Non classe
                </Text>
                {!email.categoryId && <MaterialCommunityIcons name="check" size={14} color={colors.primary} />}
              </TouchableOpacity>
              {catList.map((cat: any) => {
                const isActive = email.categoryId === cat.categoryId;
                return (
                  <TouchableOpacity
                    key={cat.categoryId}
                    style={[s.pickerOption, isActive && { backgroundColor: colors.primary + "10" }]}
                    onPress={() => handleUpdateCategory(cat.categoryId.toString())}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pickerOptionText, { color: isActive ? colors.primary : colors.foreground }]}>
                      {cat.categoryName}
                    </Text>
                    {isActive && <MaterialCommunityIcons name="check" size={14} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={[s.settingDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={s.settingRow}
            onPress={() => setShowProjectPicker(!showProjectPicker)}
            activeOpacity={0.7}
          >
            <Text style={[s.settingLabel, { color: colors.mutedForeground }]}>Projet</Text>
            <View style={s.settingValueRow}>
              <Text style={[s.settingValue, { color: colors.foreground }]}>
                {email.projectReference || "Aucun projet"}
              </Text>
              <MaterialCommunityIcons
                name={showProjectPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </View>
          </TouchableOpacity>
          {showProjectPicker && (
            <View style={[s.pickerOptions, { borderColor: colors.border }]}>
              <TouchableOpacity
                style={[s.pickerOption, !email.projectId && { backgroundColor: colors.primary + "10" }]}
                onPress={() => handleUpdateProject("none")}
                activeOpacity={0.7}
              >
                <Text style={[s.pickerOptionText, { color: !email.projectId ? colors.primary : colors.foreground }]}>
                  Aucun projet
                </Text>
                {!email.projectId && <MaterialCommunityIcons name="check" size={14} color={colors.primary} />}
              </TouchableOpacity>
              {projList.map((p: any) => {
                const isActive = email.projectId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.pickerOption, isActive && { backgroundColor: colors.primary + "10" }]}
                    onPress={() => handleUpdateProject(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pickerOptionText, { color: isActive ? colors.primary : colors.foreground }]}>
                      {p.reference} — {p.name}
                    </Text>
                    {isActive && <MaterialCommunityIcons name="check" size={14} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {replyOpen && (
          <View style={[s.replyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.replyTitle, { color: colors.foreground }]}>Repondre</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Destinataire</Text>
            <TextInput
              value={replyTo}
              onChangeText={setReplyTo}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Sujet</Text>
            <TextInput
              value={replySubject}
              onChangeText={setReplySubject}
              placeholder="Sujet"
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Message</Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Ecrivez votre reponse..."
              placeholderTextColor={colors.mutedForeground + "60"}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={[s.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <View style={s.replyActions}>
              <TouchableOpacity
                style={[s.replyCancel, { borderColor: colors.border }]}
                onPress={() => { setReplyOpen(false); setReplyTo(""); setReplySubject(""); setReplyText(""); }}
                activeOpacity={0.7}
              >
                <Text style={[s.replyCancelText, { color: colors.mutedForeground }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.replySend,
                  { backgroundColor: colors.primary },
                  (!replyTo.trim() || !replySubject.trim() || !replyText.trim() || sendEmail.isPending) && { opacity: 0.5 },
                ]}
                onPress={handleSendReply}
                activeOpacity={0.7}
                disabled={!replyTo.trim() || !replySubject.trim() || !replyText.trim() || sendEmail.isPending}
              >
                <MaterialCommunityIcons name="send" size={14} color="#fff" />
                <Text style={s.replySendText}>
                  {sendEmail.isPending ? "Envoi..." : "Envoyer"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[s.backBottomBtn, { borderColor: colors.border }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={16} color={colors.mutedForeground} />
          <Text style={[s.backBottomLabel, { color: colors.mutedForeground }]}>Retour</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  full: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyLabel: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 12 },

  scroll: { padding: 16 },

  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },

  subjectRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  subjectText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    flex: 1,
    lineHeight: 24,
  },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  priorityLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  senderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderInfo: { flex: 1, minWidth: 0 },
  senderName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },

  summaryCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  summaryTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  bodyCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },

  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 0 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  settingsCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  settingDivider: { height: 1 },
  pickerOptions: { paddingHorizontal: 8, paddingBottom: 8 },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
  },
  pickerOptionText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },

  replyCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  replyTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  textarea: {
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  replyActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  replyCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  replyCancelText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  replySend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  replySendText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#fff" },

  backBottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  backBottomLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
