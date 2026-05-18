import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSendEmail, getListEmailsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

export default function ComposeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ to?: string; subject?: string; body?: string; replyToEmailId?: string }>();
  const isWeb = Platform.OS === "web";

  const [to, setTo] = useState(params.to ?? "");
  const [subject, setSubject] = useState(params.subject ?? "");
  const [body, setBody] = useState(params.body ?? "");
  const sendEmail = useSendEmail();

  const canSend = to.trim().length > 0 && subject.trim().length > 0 && !sendEmail.isPending;

  const handleSend = () => {
    if (!canSend) return;
    sendEmail.mutate(
      {
        data: {
          to: to.trim(),
          subject: subject.trim(),
          body: body,
          replyToEmailId: params.replyToEmailId ? Number(params.replyToEmailId) : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          router.back();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Erreur inconnue";
          Alert.alert("Envoi impossible", msg);
        },
      }
    );
  };

  const confirmDiscard = () => {
    if (to || subject || body) {
      Alert.alert("Abandonner le brouillon ?", "Le contenu non envoyé sera perdu.", [
        { text: "Continuer", style: "cancel" },
        { text: "Abandonner", style: "destructive", onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[s.container, { backgroundColor: colors.background, paddingTop: isWeb ? 67 : 0 }]}
    >
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={confirmDiscard} hitSlop={8} style={s.headerBtn}>
          <MaterialCommunityIcons name="close" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>Nouveau message</Text>
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            s.sendBtn,
            {
              backgroundColor: canSend ? colors.primary : colors.primary + "40",
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {sendEmail.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <MaterialCommunityIcons name="send" size={14} color={colors.primaryForeground} />
              <Text style={[s.sendText, { color: colors.primaryForeground }]}>Envoyer</Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.form, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.field, { borderBottomColor: colors.border }]}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>À</Text>
          <TextInput
            style={[s.fieldInput, { color: colors.foreground }]}
            value={to}
            onChangeText={setTo}
            placeholder="destinataire@exemple.com"
            placeholderTextColor={colors.mutedForeground + "80"}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[s.field, { borderBottomColor: colors.border }]}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Objet</Text>
          <TextInput
            style={[s.fieldInput, { color: colors.foreground }]}
            value={subject}
            onChangeText={setSubject}
            placeholder="Sujet du mail"
            placeholderTextColor={colors.mutedForeground + "80"}
          />
        </View>

        <TextInput
          style={[s.bodyInput, { color: colors.foreground }]}
          value={body}
          onChangeText={setBody}
          placeholder="Écris ton message…"
          placeholderTextColor={colors.mutedForeground + "80"}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 6 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  form: { padding: 16, gap: 0 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 50 },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  bodyInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 280,
    paddingTop: 16,
  },
});
