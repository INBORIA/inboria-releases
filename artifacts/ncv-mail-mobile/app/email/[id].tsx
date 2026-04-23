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
  Share,
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
  useCreateTask,
  useCreateAppointment,
  getListEmailsQueryKey,
  getGetEmailQueryKey,
  getListTasksQueryKey,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cleanEmailBody } from "@/utils/cleanEmailBody";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { convert as htmlToPlainText } from "html-to-text";

function htmlBodyToPlainText(raw: string): string {
  if (!raw) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(raw);
  if (!looksLikeHtml) return raw;
  try {
    const text = htmlToPlainText(raw, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "script", format: "skip" },
        { selector: "head", format: "skip" },
        { selector: "a", options: { ignoreHref: false, hideLinkHrefIfSameAsText: true } },
        { selector: "hr", format: "skip" },
      ],
    });
    return text.replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return raw.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  }
}

function buildForwardCitation(email: any, t: (k: string) => string): string {
  const header = t("emailDetail.forwardCitationHeader");
  const fromLabel = t("emailDetail.forwardFromLabel");
  const dateLabel = t("emailDetail.forwardDateLabel");
  const subjectLabel = t("emailDetail.forwardSubjectLabel");
  const toLabel = t("emailDetail.forwardToLabel");
  let dateStr = "";
  try {
    const rawDate = email?.createdAt || email?.created_at || email?.received_at;
    if (rawDate) dateStr = new Date(rawDate).toLocaleString();
  } catch { dateStr = ""; }
  const plainBody = htmlBodyToPlainText(email?.body || "");
  return [
    "",
    header,
    `${fromLabel} : ${email?.sender || ""}`,
    `${dateLabel} : ${dateStr}`,
    `${subjectLabel} : ${email?.subject || ""}`,
    `${toLabel} : ${email?.recipient || ""}`,
    "",
    plainBody.split("\n").map((l) => `> ${l}`).join("\n"),
  ].join("\n");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatLocalDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseLocalDateTime(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return isNaN(d.getTime()) ? null : d;
}

let Haptics: typeof import("expo-haptics") | null = null;
try {
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

const PRIORITIES = ["urgent", "moyen", "faible"] as const;

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isWeb = Platform.OS === "web";

  const PRIORITY_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
    urgent: { bg: "#ef444420", fg: "#ef4444", label: t("emailDetail.priorityUrgent") },
    moyen: { bg: "#f59e0b20", fg: "#f59e0b", label: t("emailDetail.priorityMedium") },
    faible: { bg: "#22c55e20", fg: "#22c55e", label: t("emailDetail.priorityLow") },
  };

  const { data: email, isLoading } = useGetEmail(Number(id));
  const { data: profile } = useGetProfile();
  const { data: categories } = useListCategories();
  const { data: projects } = useListProjects();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const sendEmail = useSendEmail();
  const generateDraft = useGenerateDraft();
  const createTaskMut = useCreateTask();
  const createAppointmentMut = useCreateAppointment();
  const { session } = useAuth();

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardSubject, setForwardSubject] = useState("");
  const [forwardText, setForwardText] = useState("");
  const [forwardAiLoading, setForwardAiLoading] = useState(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState<string>("");

  const [rdvOpen, setRdvOpen] = useState(false);
  const [rdvLoading, setRdvLoading] = useState(false);
  const [rdvTitle, setRdvTitle] = useState("");
  const [rdvLocation, setRdvLocation] = useState("");
  const [rdvParticipants, setRdvParticipants] = useState("");
  const [rdvStart, setRdvStart] = useState("");
  const [rdvEnd, setRdvEnd] = useState("");
  const [rdvDescription, setRdvDescription] = useState("");

  const apiBase = useMemo(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}` : "";
  }, []);

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
      if (confirm(t("emailDetail.deleteConfirm"))) doDelete();
    } else {
      Alert.alert(t("common.delete"), t("emailDetail.deleteConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleReplyOpen = () => {
    if (!email) return;
    setReplyTo((email as any).senderEmail || "");
    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setReplyText("");
    setReplyOpen(true);
  };

  const handleAiDraft = () => {
    if (!email) return;
    setReplyTo((email as any).senderEmail || "");
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

  const handleForwardOpen = () => {
    if (!email) return;
    setForwardTo("");
    setForwardSubject(email.subject?.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject || ""}`);
    setForwardText(buildForwardCitation(email, t));
    setForwardOpen(true);
  };

  const handleForwardAi = async () => {
    if (!email) return;
    setForwardTo("");
    setForwardSubject(email.subject?.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject || ""}`);
    const citation = buildForwardCitation(email, t);
    setForwardText(citation);
    setForwardOpen(true);
    setForwardAiLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/ai/forward-intro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ emailId: Number(id) }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const intro = (data?.intro || "").trim();
        if (intro) setForwardText(`${intro}\n${citation}`);
      }
    } catch {}
    setForwardAiLoading(false);
  };

  const handleSendForward = () => {
    if (!forwardTo.trim() || !forwardSubject.trim() || !forwardText.trim()) return;
    hapticMedium();
    sendEmail.mutate(
      { data: { to: forwardTo, subject: forwardSubject, body: forwardText } },
      {
        onSuccess: () => {
          setForwardOpen(false);
          setForwardTo("");
          setForwardSubject("");
          setForwardText("");
          invalidateAll();
        },
      },
    );
  };

  const handleCreateTaskOpen = () => {
    if (!email) return;
    setTaskTitle(email.subject || "");
    setTaskProjectId(email.projectId ? String(email.projectId) : "");
    setTaskOpen(true);
  };

  const handleSubmitTask = () => {
    if (!taskTitle.trim()) return;
    hapticMedium();
    const payload: any = { title: taskTitle.trim(), emailId: Number(id) };
    if (taskProjectId) payload.projectId = taskProjectId;
    createTaskMut.mutate(
      { data: payload },
      {
        onSuccess: () => {
          setTaskOpen(false);
          setTaskTitle("");
          setTaskProjectId("");
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          if (Platform.OS === "web") {
            try { (window as any).alert?.(t("emailDetail.taskCreated")); } catch {}
          } else {
            Alert.alert(t("emailDetail.taskCreated"));
          }
        },
        onError: () => {
          if (Platform.OS !== "web") Alert.alert(t("common.error"));
        },
      },
    );
  };

  const handleCreateRdvOpen = async () => {
    if (!email) return;
    const fallbackStart = new Date();
    fallbackStart.setMinutes(0, 0, 0);
    fallbackStart.setHours(fallbackStart.getHours() + 1);
    const fallbackEnd = new Date(fallbackStart.getTime() + 60 * 60 * 1000);
    setRdvTitle(email.subject || "");
    setRdvLocation("");
    setRdvParticipants(email.sender || "");
    setRdvStart(formatLocalDateTime(fallbackStart));
    setRdvEnd(formatLocalDateTime(fallbackEnd));
    setRdvDescription("");
    setRdvOpen(true);
    setRdvLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/ai/extract-appointment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ emailId: Number(id) }),
      });
      if (resp.ok) {
        const ex = await resp.json();
        if (ex?.title) setRdvTitle(ex.title);
        if (ex?.location) setRdvLocation(ex.location);
        if (ex?.participants) setRdvParticipants(ex.participants);
        if (ex?.description) setRdvDescription(ex.description);
        if (ex?.startAt) {
          const d = new Date(ex.startAt);
          if (!isNaN(d.getTime())) setRdvStart(formatLocalDateTime(d));
        }
        if (ex?.endAt) {
          const d = new Date(ex.endAt);
          if (!isNaN(d.getTime())) setRdvEnd(formatLocalDateTime(d));
        }
      }
    } catch {}
    setRdvLoading(false);
  };

  const handleSubmitRdv = () => {
    if (!rdvTitle.trim()) return;
    const start = parseLocalDateTime(rdvStart);
    const end = parseLocalDateTime(rdvEnd);
    if (!start || !end) {
      if (Platform.OS !== "web") Alert.alert(t("emailDetail.rdvInvalidDate"));
      return;
    }
    hapticMedium();
    const payload: any = {
      title: rdvTitle.trim(),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      emailId: Number(id),
    };
    if (rdvLocation.trim()) payload.location = rdvLocation.trim();
    if (rdvDescription.trim()) payload.description = rdvDescription.trim();
    if (rdvParticipants.trim()) payload.participants = rdvParticipants.trim();
    createAppointmentMut.mutate(
      { data: payload },
      {
        onSuccess: () => {
          setRdvOpen(false);
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          if (Platform.OS === "web") {
            try { (window as any).alert?.(t("emailDetail.rdvCreated")); } catch {}
          } else {
            Alert.alert(t("emailDetail.rdvCreated"));
          }
        },
        onError: () => {
          if (Platform.OS !== "web") Alert.alert(t("common.error"));
        },
      },
    );
  };

  const handleExport = async () => {
    if (!email) return;
    const plain = htmlBodyToPlainText(email.body || "");
    const message = [
      `${t("emailDetail.subject")}: ${email.subject || ""}`,
      `${t("emailDetail.forwardFromLabel")}: ${email.sender || ""}${(email as any).senderEmail ? ` <${(email as any).senderEmail}>` : ""}`,
      `${t("emailDetail.forwardDateLabel")}: ${email.createdAt ? new Date(email.createdAt).toLocaleString() : ""}`,
      "",
      plain,
    ].join("\n");
    try {
      await Share.share({
        message,
        title: email.subject || "Email",
      });
    } catch {}
  };

  const handleUpdatePriority = (priority: string) => {
    hapticLight();
    updateEmail.mutate(
      { id: Number(id), data: { priority } as any },
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
        <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>{t("emailDetail.notFound")}</Text>
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
              {(email as any).senderEmail ? (
                <Text style={[s.senderEmail, { color: colors.mutedForeground }]}>
                  {(email as any).senderEmail}
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
              <Text style={[s.summaryTitle, { color: colors.primary }]}>{t("emailDetail.aiSummary")}</Text>
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
            {cleanedBody || t("common.noContent")}
          </Text>
        </View>

        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleReplyOpen}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="reply" size={16} color="#fff" />
            <Text style={[s.actionLabel, { color: "#fff" }]}>{t("emailDetail.reply")}</Text>
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
              {generateDraft.isPending ? t("emailDetail.generating") : t("emailDetail.aiReply")}
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
              <Text style={[s.actionLabel, { color: colors.primary }]}>{t("emailDetail.markRead")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleArchive}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="archive-outline" size={16} color={colors.mutedForeground} />
            <Text style={[s.actionLabel, { color: colors.mutedForeground }]}>{t("emailDetail.archiveBtn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: "#ef444430" }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" />
            <Text style={[s.actionLabel, { color: "#ef4444" }]}>{t("emailDetail.deleteBtn")}</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.actionsRow, { marginTop: 8 }]}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleForwardOpen}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="share-outline" size={16} color={colors.foreground} />
            <Text style={[s.actionLabel, { color: colors.foreground }]}>{t("emailDetail.forward")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
            onPress={handleForwardAi}
            activeOpacity={0.7}
            disabled={forwardAiLoading}
          >
            {forwardAiLoading ? (
              <ActivityIndicator size={14} color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="auto-fix" size={16} color={colors.primary} />
            )}
            <Text style={[s.actionLabel, { color: colors.primary }]}>{t("emailDetail.forwardAi")}</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.actionsRow, { marginTop: 8 }]}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleCreateTaskOpen}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="checkbox-marked-circle-plus-outline" size={16} color={colors.foreground} />
            <Text style={[s.actionLabel, { color: colors.foreground }]}>{t("emailDetail.createTask")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleCreateRdvOpen}
            activeOpacity={0.7}
            disabled={rdvLoading}
          >
            {rdvLoading ? (
              <ActivityIndicator size={14} color={colors.foreground} />
            ) : (
              <MaterialCommunityIcons name="calendar-plus" size={16} color={colors.foreground} />
            )}
            <Text style={[s.actionLabel, { color: colors.foreground }]}>{t("emailDetail.createRdv")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleExport}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="export-variant" size={16} color={colors.foreground} />
            <Text style={[s.actionLabel, { color: colors.foreground }]}>{t("emailDetail.export")}</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={s.settingRow}
            onPress={() => setShowPriorityPicker(!showPriorityPicker)}
            activeOpacity={0.7}
          >
            <Text style={[s.settingLabel, { color: colors.mutedForeground }]}>{t("emailDetail.priority")}</Text>
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
            <Text style={[s.settingLabel, { color: colors.mutedForeground }]}>{t("emailDetail.category")}</Text>
            <View style={s.settingValueRow}>
              <Text style={[s.settingValue, { color: colors.foreground }]}>
                {email.categoryName || t("emailDetail.uncategorized")}
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
                  {t("emailDetail.uncategorized")}
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
            <Text style={[s.settingLabel, { color: colors.mutedForeground }]}>{t("emailDetail.project")}</Text>
            <View style={s.settingValueRow}>
              <Text style={[s.settingValue, { color: colors.foreground }]}>
                {email.projectReference || t("emailDetail.noProject")}
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
                  {t("emailDetail.noProject")}
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
            <Text style={[s.replyTitle, { color: colors.foreground }]}>{t("emailDetail.replyTitle")}</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.recipient")}</Text>
            <TextInput
              value={replyTo}
              onChangeText={setReplyTo}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.subject")}</Text>
            <TextInput
              value={replySubject}
              onChangeText={setReplySubject}
              placeholder={t("emailDetail.subject")}
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.message")}</Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t("emailDetail.messagePlaceholder")}
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
                <Text style={[s.replyCancelText, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
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
                  {sendEmail.isPending ? t("emailDetail.sending") : t("emailDetail.send")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {forwardOpen && (
          <View style={[s.replyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.replyTitle, { color: colors.foreground }]}>{t("emailDetail.forwardTitle")}</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.recipient")}</Text>
            <TextInput
              value={forwardTo}
              onChangeText={setForwardTo}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.subject")}</Text>
            <TextInput
              value={forwardSubject}
              onChangeText={setForwardSubject}
              placeholder={t("emailDetail.subject")}
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.message")}</Text>
            <TextInput
              value={forwardText}
              onChangeText={setForwardText}
              placeholder={t("emailDetail.messagePlaceholder")}
              placeholderTextColor={colors.mutedForeground + "60"}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              style={[s.textarea, { height: 200, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <View style={s.replyActions}>
              <TouchableOpacity
                style={[s.replyCancel, { borderColor: colors.border }]}
                onPress={() => { setForwardOpen(false); setForwardTo(""); setForwardSubject(""); setForwardText(""); }}
                activeOpacity={0.7}
              >
                <Text style={[s.replyCancelText, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.replySend,
                  { backgroundColor: colors.primary },
                  (!forwardTo.trim() || !forwardSubject.trim() || !forwardText.trim() || sendEmail.isPending) && { opacity: 0.5 },
                ]}
                onPress={handleSendForward}
                activeOpacity={0.7}
                disabled={!forwardTo.trim() || !forwardSubject.trim() || !forwardText.trim() || sendEmail.isPending}
              >
                <MaterialCommunityIcons name="send" size={14} color="#fff" />
                <Text style={s.replySendText}>
                  {sendEmail.isPending ? t("emailDetail.sending") : t("emailDetail.send")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {taskOpen && (
          <View style={[s.replyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.replyTitle, { color: colors.foreground }]}>{t("emailDetail.createTaskTitle")}</Text>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.taskTitleLabel")}</Text>
            <TextInput
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder={t("emailDetail.taskTitlePlaceholder")}
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.taskProjectLabel")}</Text>
            <View style={[s.pickerOptions, { borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 4, marginBottom: 14, maxHeight: 200 }]}>
              <ScrollView nestedScrollEnabled>
                <TouchableOpacity
                  style={[s.pickerOption, !taskProjectId && { backgroundColor: colors.primary + "10" }]}
                  onPress={() => setTaskProjectId("")}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pickerOptionText, { color: !taskProjectId ? colors.primary : colors.foreground }]}>
                    {t("emailDetail.noProject")}
                  </Text>
                  {!taskProjectId && <MaterialCommunityIcons name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
                {projList.map((p: any) => {
                  const active = String(p.id) === taskProjectId;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.pickerOption, active && { backgroundColor: colors.primary + "10" }]}
                      onPress={() => setTaskProjectId(String(p.id))}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.pickerOptionText, { color: active ? colors.primary : colors.foreground }]}>
                        {p.reference} — {p.name}
                      </Text>
                      {active && <MaterialCommunityIcons name="check" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={s.replyActions}>
              <TouchableOpacity
                style={[s.replyCancel, { borderColor: colors.border }]}
                onPress={() => { setTaskOpen(false); setTaskTitle(""); setTaskProjectId(""); }}
                activeOpacity={0.7}
              >
                <Text style={[s.replyCancelText, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.replySend,
                  { backgroundColor: colors.primary },
                  (!taskTitle.trim() || createTaskMut.isPending) && { opacity: 0.5 },
                ]}
                onPress={handleSubmitTask}
                activeOpacity={0.7}
                disabled={!taskTitle.trim() || createTaskMut.isPending}
              >
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
                <Text style={s.replySendText}>
                  {createTaskMut.isPending ? t("emailDetail.sending") : t("common.save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {rdvOpen && (
          <View style={[s.replyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.replyTitle, { color: colors.foreground }]}>{t("emailDetail.createRdvTitle")}</Text>
            {rdvLoading && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <ActivityIndicator size={14} color={colors.primary} />
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t("emailDetail.rdvAnalyzing")}</Text>
              </View>
            )}

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.rdvTitleLabel")}</Text>
            <TextInput
              value={rdvTitle}
              onChangeText={setRdvTitle}
              placeholder={t("emailDetail.rdvTitleLabel")}
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.rdvLocation")}</Text>
            <TextInput
              value={rdvLocation}
              onChangeText={setRdvLocation}
              placeholder={t("emailDetail.rdvLocationPlaceholder")}
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.rdvParticipants")}</Text>
            <TextInput
              value={rdvParticipants}
              onChangeText={setRdvParticipants}
              placeholder={t("emailDetail.rdvParticipants")}
              placeholderTextColor={colors.mutedForeground + "60"}
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.rdvStart")}</Text>
                <TextInput
                  value={rdvStart}
                  onChangeText={setRdvStart}
                  placeholder="2026-04-23 14:00"
                  placeholderTextColor={colors.mutedForeground + "60"}
                  autoCapitalize="none"
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.rdvEnd")}</Text>
                <TextInput
                  value={rdvEnd}
                  onChangeText={setRdvEnd}
                  placeholder="2026-04-23 15:00"
                  placeholderTextColor={colors.mutedForeground + "60"}
                  autoCapitalize="none"
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>
            </View>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t("emailDetail.rdvDescription")}</Text>
            <TextInput
              value={rdvDescription}
              onChangeText={setRdvDescription}
              placeholder={t("emailDetail.rdvDescription")}
              placeholderTextColor={colors.mutedForeground + "60"}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[s.textarea, { height: 80, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <View style={s.replyActions}>
              <TouchableOpacity
                style={[s.replyCancel, { borderColor: colors.border }]}
                onPress={() => setRdvOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={[s.replyCancelText, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.replySend,
                  { backgroundColor: colors.primary },
                  (!rdvTitle.trim() || createAppointmentMut.isPending) && { opacity: 0.5 },
                ]}
                onPress={handleSubmitRdv}
                activeOpacity={0.7}
                disabled={!rdvTitle.trim() || createAppointmentMut.isPending}
              >
                <MaterialCommunityIcons name="calendar-check" size={14} color="#fff" />
                <Text style={s.replySendText}>
                  {createAppointmentMut.isPending ? t("emailDetail.sending") : t("common.save")}
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
          <Text style={[s.backBottomLabel, { color: colors.mutedForeground }]}>{t("common.back")}</Text>
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

  subjectRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  subjectText: { fontSize: 17, fontFamily: "Inter_700Bold", flex: 1, lineHeight: 24 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  priorityLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  senderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  senderInfo: { flex: 1, minWidth: 0 },
  senderName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },

  summaryCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  summaryTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  summaryBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  bodyCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },

  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  settingsCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 8, marginBottom: 12 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  settingLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  settingValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  settingDivider: { height: 1 },
  pickerOptions: { borderTopWidth: 1, paddingTop: 4, marginBottom: 4 },
  pickerOption: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6 },
  pickerOptionText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },

  replyCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  replyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 14 },
  textarea: { height: 120, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 14 },
  replyActions: { flexDirection: "row", gap: 10 },
  replyCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  replyCancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  replySend: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10 },
  replySendText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  backBottomBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  backBottomLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
