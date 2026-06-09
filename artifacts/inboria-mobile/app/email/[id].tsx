import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CenterState, FullLoader } from "@/components/StateViews";
import { useColors } from "@/hooks/useColors";
import {
  getEmail,
  markEmailRead,
  sendReply,
  type EmailDetail,
} from "@/lib/api";
import { htmlToText } from "@/lib/html";

export default function EmailDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sent, setSent] = useState(false);
  const markedRef = useRef(false);

  const query = useQuery({
    queryKey: ["email", id],
    queryFn: () => getEmail(id),
    enabled: !!id,
  });

  const email = query.data;

  useEffect(() => {
    if (email && !markedRef.current && (email.status || "").toLowerCase() !== "read") {
      markedRef.current = true;
      markEmailRead(email.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["emails"] });
        })
        .catch(() => {
          markedRef.current = false;
        });
    }
  }, [email, queryClient]);

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      sendReply({
        to: email!.senderEmail,
        subject: `Re: ${email!.subject || ""}`.trim(),
        body,
        replyToEmailId: email!.id,
      }),
    onSuccess: () => {
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSent(true);
      setReplyOpen(false);
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      setTimeout(() => setSent(false), 2500);
    },
    onError: () => {
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 6, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: pressed ? colors.surfaceHover : "transparent" },
          ]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={[styles.headerTitle, { color: colors.mutedForeground }]}
        >
          Réception
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {query.isLoading ? (
        <FullLoader />
      ) : query.isError || !email ? (
        <CenterState
          icon="alert-triangle"
          title="E-mail introuvable"
          subtitle="Impossible de charger cet e-mail."
          actionLabel="Réessayer"
          onAction={() => query.refetch()}
        />
      ) : (
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={0}
          style={styles.flex}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.subject, { color: colors.foreground }]}>
              {email.subject || "(sans objet)"}
            </Text>

            <View style={styles.senderRow}>
              <Avatar name={email.sender} email={email.senderEmail} size={44} />
              <View style={styles.senderInfo}>
                <Text
                  numberOfLines={1}
                  style={[styles.senderName, { color: colors.foreground }]}
                >
                  {email.sender || email.senderEmail}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.senderEmail, { color: colors.mutedForeground }]}
                >
                  {email.senderEmail}
                </Text>
              </View>
            </View>

            {email.summary ? (
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: "rgba(45,212,191,0.08)",
                    borderColor: "rgba(45,212,191,0.25)",
                  },
                ]}
              >
                <View style={styles.summaryHead}>
                  <Feather name="zap" size={13} color={colors.accent} />
                  <Text style={[styles.summaryLabel, { color: colors.accent }]}>
                    Résumé Inboria
                  </Text>
                </View>
                <Text
                  style={[styles.summaryText, { color: colors.cardForeground }]}
                >
                  {email.summary}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.body, { color: colors.cardForeground }]}>
              {htmlToText(email.body) || "(message vide)"}
            </Text>

            {replyOpen ? (
              <ReplyComposer
                email={email}
                value={replyBody}
                onChange={setReplyBody}
                sending={replyMutation.isPending}
                error={replyMutation.isError}
                onSend={() => {
                  if (replyBody.trim().length > 0) {
                    replyMutation.mutate(replyBody.trim());
                  }
                }}
                onCancel={() => {
                  setReplyOpen(false);
                  setReplyBody("");
                }}
              />
            ) : null}
          </ScrollView>

          {!replyOpen ? (
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: insets.bottom + 12,
                  borderTopColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <Pressable
                onPress={() => setReplyOpen(true)}
                style={({ pressed }) => [
                  styles.replyBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather
                  name={sent ? "check" : "corner-up-left"}
                  size={17}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[styles.replyBtnText, { color: colors.primaryForeground }]}
                >
                  {sent ? "Envoyé" : "Répondre"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function ReplyComposer({
  email,
  value,
  onChange,
  sending,
  error,
  onSend,
  onCancel,
}: {
  email: EmailDetail;
  value: string;
  onChange: (v: string) => void;
  sending: boolean;
  error: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.composer,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.composerHead}>
        <Text style={[styles.composerTo, { color: colors.mutedForeground }]}>
          À : {email.senderEmail}
        </Text>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Votre réponse…"
        placeholderTextColor={colors.faint}
        multiline
        autoFocus
        style={[styles.composerInput, { color: colors.foreground }]}
        editable={!sending}
      />
      {error ? (
        <Text style={[styles.composerError, { color: colors.destructive }]}>
          Échec de l'envoi. Réessayez.
        </Text>
      ) : null}
      <Pressable
        onPress={onSend}
        disabled={sending || value.trim().length === 0}
        style={({ pressed }) => [
          styles.composerSend,
          {
            backgroundColor: colors.primary,
            opacity: sending || value.trim().length === 0 ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {sending ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <>
            <Feather name="send" size={15} color={colors.primaryForeground} />
            <Text
              style={[styles.composerSendText, { color: colors.primaryForeground }]}
            >
              Envoyer
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
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
  headerTitle: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1, textAlign: "center" },
  subject: {
    fontSize: 21,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
    marginBottom: 16,
  },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  senderInfo: { flex: 1 },
  senderName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  senderEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    gap: 8,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryText: { fontSize: 14.5, fontFamily: "Inter_400Regular", lineHeight: 21 },
  body: { fontSize: 15.5, fontFamily: "Inter_400Regular", lineHeight: 24 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  replyBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  composer: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    gap: 12,
  },
  composerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  composerTo: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  composerInput: {
    fontSize: 15.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    minHeight: 120,
    textAlignVertical: "top",
  },
  composerError: { fontSize: 13, fontFamily: "Inter_400Regular" },
  composerSend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 12,
  },
  composerSendText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
