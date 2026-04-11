import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const logoSource = require("@/assets/images/inboria-logo.png");

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isWeb = Platform.OS === "web";

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t("login.fillAllFields"));
      return;
    }
    if (mode === "register" && !fullName.trim()) {
      setError(t("login.enterName"));
      return;
    }
    setLoading(true);
    setError("");
    const result =
      mode === "login"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, fullName.trim());
    if (result.error) setError(result.error);
    setLoading(false);
  };

  return (
    <View
      style={[
        s.container,
        {
          backgroundColor: colors.background,
          paddingTop: isWeb ? 67 : insets.top,
          paddingBottom: isWeb ? 34 : insets.bottom,
        },
      ]}
    >
      <KeyboardAwareScrollViewCompat
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        <View style={s.logoBox}>
          <Image source={logoSource} style={s.logoImg} resizeMode="contain" />
          <Text style={[s.appTitle, { color: colors.foreground }]}>{t("login.title")}</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {mode === "login" ? t("login.loginSubtitle") : t("login.registerSubtitle")}
          </Text>
        </View>

        {error ? (
          <View
            style={[s.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={14} color={colors.destructive} />
            <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        {mode === "register" && (
          <View style={s.field}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>{t("login.fullName")}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("login.fullNamePlaceholder")}
              placeholderTextColor={colors.mutedForeground + "80"}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={s.field}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>{t("login.email")}</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder={t("login.emailPlaceholder")}
            placeholderTextColor={colors.mutedForeground + "80"}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        <View style={s.field}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>{t("login.password")}</Text>
          <View style={s.passwordWrap}>
            <TextInput
              style={[
                s.input,
                s.passwordInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground + "80"}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
            />
            <TouchableOpacity
              style={[s.eyeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.primary} />
              <Text style={[s.eyeLabel, { color: colors.primary }]}>
                {showPassword ? t("login.hidePassword") : t("login.showPassword")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.submitLabel}>
              {mode === "login" ? t("login.login") : t("login.register")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.switchBtn}
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          <Text style={[s.switchText, { color: colors.mutedForeground }]}>
            {mode === "login" ? t("login.noAccount") : t("login.hasAccount")}
            <Text style={{ color: colors.primary }}>
              {mode === "login" ? t("login.signUp") : t("login.signIn")}
            </Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, justifyContent: "center", flexGrow: 1 },

  logoBox: { alignItems: "center", marginBottom: 40 },
  logoImg: { width: 80, height: 80, marginBottom: 16 },
  appTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },

  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 80 },
  eyeBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  eyeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  submitBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitLabel: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  switchBtn: { alignItems: "center", marginTop: 20 },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
