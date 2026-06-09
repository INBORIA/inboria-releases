import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { sendEmail } from "@/lib/api";

export default function ComposeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { to: toParam } = useLocalSearchParams<{ to?: string }>();
  const [to, setTo] = useState(toParam || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: () =>
      sendEmail({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
    onSuccess: () => {
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    },
    onError: () => {
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

  const valid =
    to.trim().length > 3 &&
    to.includes("@") &&
    subject.trim().length > 0 &&
    body.trim().length > 0;

  function submit() {
    if (valid && !send.isPending) send.mutate();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Nouvel e-mail"
        right={
          <Pressable onPress={submit} disabled={!valid || send.isPending} hitSlop={8}>
            {send.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather
                name="send"
                size={20}
                color={valid ? colors.primary : colors.faint}
              />
            )}
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field
            label="À"
            value={to}
            onChange={setTo}
            placeholder="destinataire@exemple.com"
            keyboardType="email-address"
          />
          <Field
            label="Objet"
            value={subject}
            onChange={setSubject}
            placeholder="Objet du message"
          />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Message
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Écrivez votre message…"
            placeholderTextColor={colors.faint}
            multiline
            style={[
              styles.bodyInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          {send.isError ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              Échec de l'envoi. Vérifiez le destinataire et réessayez.
            </Text>
          ) : null}
          <Pressable
            onPress={submit}
            disabled={!valid || send.isPending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity: !valid || send.isPending ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {send.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="send" size={16} color={colors.primaryForeground} />
                <Text
                  style={[styles.sendBtnText, { color: colors.primaryForeground }]}
                >
                  Envoyer
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: "email-address" | "default";
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType || "default"}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.input,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  bodyInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 200,
    fontSize: 15.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    textAlignVertical: "top",
  },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 12 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 20,
  },
  sendBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
