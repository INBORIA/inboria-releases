import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 1 && !submitting;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 24;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(
        err.toLowerCase().includes("invalid")
          ? "E-mail ou mot de passe incorrect."
          : err,
      );
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setSubmitting(false);
    }
    // On success the auth listener redirects automatically.
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={[styles.container, { paddingTop: topPad }]}>
          <View style={styles.brand}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logo}
            >
              <Feather name="send" size={26} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Inboria
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Votre boîte mail, en pilote automatique.
            </Text>
          </View>

          <View style={styles.form}>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.input, borderColor: colors.border },
              ]}
            >
              <Feather name="mail" size={18} color={colors.mutedForeground} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="E-mail"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                inputMode="email"
                style={[styles.input, { color: colors.foreground }]}
                editable={!submitting}
              />
            </View>

            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.input, borderColor: colors.border },
              ]}
            >
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Mot de passe"
                placeholderTextColor={colors.faint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: colors.foreground }]}
                editable={!submitting}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <Feather
                  name="alert-circle"
                  size={14}
                  color={colors.destructive}
                />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text
                  style={[
                    styles.buttonText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Se connecter
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: "flex-start" },
  brand: { alignItems: "center", marginTop: 40, marginBottom: 44, gap: 10 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  form: { gap: 14 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", height: "100%" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  button: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  buttonText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
