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
  useWindowDimensions,
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
  accent: "#6C63FF",
};

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

type FieldId = "name" | "cpf" | "email" | "pass" | "confirm";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<FieldId | null>(null);

  const handleRegister = async () => {
    if (!name.trim() || !cpf || !email.trim() || !password || !confirm) {
      Alert.alert("Campos obrigatórios", "Preencha todos os campos.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Senhas diferentes", "A confirmação de senha não confere.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Senha fraca", "A senha deve ter ao menos 6 caracteres.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await register(name.trim(), cpf.replace(/\D/g, ""), email.trim(), password);
      // _layout redirects automatically after login state changes
    } catch (err: any) {
      Alert.alert("Erro ao cadastrar", err.message ?? "Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: FieldId,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    value: string,
    onChange: (v: string) => void,
    extra?: {
      placeholder?: string;
      keyboardType?: any;
      secure?: boolean;
      showToggle?: boolean;
      onToggle?: () => void;
      autoComplete?: any;
      maxLength?: number;
    }
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, focused === id && { color: C.primary }]}>{label}</Text>
      <View style={[styles.inputRow, focused === id && styles.inputRowFocused]}>
        <Ionicons name={icon} size={18} color={focused === id ? C.primary : C.textMuted} />
        <TextInput
          style={[styles.input, extra?.showToggle && { flex: 1 }]}
          placeholder={extra?.placeholder ?? label}
          placeholderTextColor={C.textMuted}
          value={value}
          onChangeText={onChange}
          secureTextEntry={extra?.secure}
          keyboardType={extra?.keyboardType ?? "default"}
          autoComplete={extra?.autoComplete}
          autoCapitalize={id === "name" ? "words" : "none"}
          maxLength={extra?.maxLength}
          onFocus={() => setFocused(id)}
          onBlur={() => setFocused(null)}
        />
        {extra?.showToggle && (
          <Pressable onPress={extra.onToggle} hitSlop={12}>
            <Ionicons
              name={extra.secure ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={C.textMuted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            minHeight: screenHeight,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoBox}>
            <Image
              source={require("../../assets/images/logo.jpeg")}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brand}>SOLICITE</Text>
          <Text style={styles.tagline}>Criar nova conta</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cadastro</Text>

          {field("name", "Nome completo", "person-outline", name, setName, {
            placeholder: "Seu nome completo",
            autoComplete: "name",
          })}

          {field("cpf", "CPF", "card-outline", cpf, (v) => setCpf(formatCPF(v)), {
            placeholder: "000.000.000-00",
            keyboardType: "numeric",
            maxLength: 14,
          })}

          {field("email", "E-mail", "mail-outline", email, setEmail, {
            placeholder: "seu@email.com",
            keyboardType: "email-address",
            autoComplete: "email",
          })}

          {field(
            "pass",
            "Senha",
            "lock-closed-outline",
            password,
            setPassword,
            {
              placeholder: "Mínimo 6 caracteres",
              secure: !showPass,
              showToggle: true,
              onToggle: () => setShowPass((v) => !v),
              autoComplete: "new-password",
            }
          )}

          {field(
            "confirm",
            "Confirmar senha",
            "lock-closed-outline",
            confirm,
            setConfirm,
            {
              placeholder: "Repita sua senha",
              secure: !showConfirm,
              showToggle: true,
              onToggle: () => setShowConfirm((v) => !v),
            }
          )}

          {/* Nota de segurança */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark" size={16} color={C.primary} />
            <Text style={styles.securityText}>
              Seus dados são usados para segurança da plataforma. CPF e senha são protegidos com criptografia.
            </Text>
          </View>

          {/* Botão cadastrar */}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.82, shadowOpacity: 0.3 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <View style={styles.btnGlow} />
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color="#000" />
                <Text style={styles.btnText}>Criar Conta</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Já tenho conta */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Já tem uma conta?</Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={12}>
            <Text style={styles.switchLink}> Entrar</Text>
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
    paddingHorizontal: 24,
    gap: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  logoArea: { alignItems: "center", gap: 8, width: "100%" },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    borderWidth: 2,
    borderColor: "rgba(0,212,255,0.4)",
  },
  logoImage: { width: 80, height: 80 },
  brand: { fontSize: 24, fontWeight: "800", color: C.text, letterSpacing: 4 },
  tagline: { fontSize: 13, color: C.textSecondary },

  card: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 2,
  },

  fieldGroup: { gap: 6 },
  label: {
    fontSize: 11,
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
    paddingVertical: 13,
    gap: 10,
  },
  inputRowFocused: { borderColor: C.primary, backgroundColor: C.primaryGlow },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },

  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(0,212,255,0.05)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.15)",
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 18,
  },

  btn: {
    overflow: "hidden",
    position: "relative",
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
    shadowColor: C.primary,
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.55)",
  },
  btnGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  btnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#000", letterSpacing: 0.3 },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  switchLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },
  switchLink: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary },
});
