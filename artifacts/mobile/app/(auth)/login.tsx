import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

const C = {
  bg: "#0A0A0F",
  card: "#12121A",
  border: "#1E1E2E",
  primary: "#00D4FF",
  primaryGlow: "rgba(0,212,255,0.08)",
  text: "#FFFFFF",
  textSecondary: "#A0A0B8",
  textMuted: "#555570",
  danger: "#FF3B5C",
  success: "#00E676",
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<"email" | "pass" | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Campos obrigatórios", "Informe e-mail e senha.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await login(email.trim(), password);
      // AuthContext + _layout redirects automatically
    } catch (err: any) {
      Alert.alert("Erro ao entrar", err.message ?? "Verifique seus dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + branding */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing2} />
          <View style={styles.logoRing1} />
          <View style={styles.logoBox}>
            <Image
              source={require("../../assets/images/logo.jpeg")}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brand}>SOLICITE</Text>
          <Text style={styles.tagline}>Serviços sob demanda</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar na conta</Text>

          {/* E-mail */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, focused === "email" && { color: C.primary }]}>E-mail</Text>
            <View style={[styles.inputRow, focused === "email" && styles.inputRowFocused]}>
              <Ionicons name="mail-outline" size={18} color={focused === "email" ? C.primary : C.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          {/* Senha */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, focused === "pass" && { color: C.primary }]}>Senha</Text>
            <View style={[styles.inputRow, focused === "pass" && styles.inputRowFocused]}>
              <Ionicons name="lock-closed-outline" size={18} color={focused === "pass" ? C.primary : C.textMuted} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Sua senha"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete="current-password"
                onFocus={() => setFocused("pass")}
                onBlur={() => setFocused(null)}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={12}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Botão entrar */}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#000" />
                <Text style={styles.btnText}>Entrar</Text>
              </>
            )}
          </Pressable>

          {/* Segurança */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={C.textMuted} />
            <Text style={styles.securityText}>
              Seus dados são usados para segurança da plataforma
            </Text>
          </View>
        </View>

        {/* Ir para cadastro */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Ainda não tem conta?</Text>
          <Pressable onPress={() => router.replace("/(auth)/register")} hitSlop={12}>
            <Text style={styles.switchLink}> Cadastre-se</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    gap: 24,
    alignItems: "center",
  },

  logoArea: { alignItems: "center", gap: 10, width: "100%", marginBottom: 4 },
  logoRing1: {
    position: "absolute",
    top: -10,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.12)",
    backgroundColor: "transparent",
  },
  logoRing2: {
    position: "absolute",
    top: -20,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.06)",
    backgroundColor: "transparent",
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
    borderWidth: 2,
    borderColor: "rgba(0,212,255,0.4)",
  },
  logoImage: { width: 100, height: 100 },
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 5,
  },
  tagline: {
    fontSize: 13,
    color: C.textSecondary,
    letterSpacing: 0.5,
  },

  card: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    gap: 18,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 2,
  },

  fieldGroup: { gap: 6 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0E18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  inputRowFocused: { borderColor: C.primary, backgroundColor: C.primaryGlow },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },

  btn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  btnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },

  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  securityText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    flex: 1,
    lineHeight: 17,
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  switchLink: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: C.primary,
  },
});
