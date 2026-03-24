import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { SoliciteLogo } from "@/components/SoliciteLogo";

const C = Colors.dark;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCPF(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatDate(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function validateCPF(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  return digits.length === 11;
}

function calcAge(birthDate: string): number | null {
  const [d, m, y] = birthDate.split("/").map(Number);
  if (!d || !m || !y || y < 1900) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  icon,
  error,
  required,
  children,
}: {
  label: string;
  icon: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Ionicons name={icon as any} size={14} color={C.primary} />
        <Text style={styles.fieldLabel}>
          {label}
          {required && <Text style={{ color: C.danger }}> *</Text>}
        </Text>
      </View>
      {children}
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={12} color={C.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Specialties ───────────────────────────────────────────────────────────────

const SPECIALTIES = [
  "Limpeza e Faxina",
  "Elétrica",
  "Hidráulica",
  "Pintura",
  "Marcenaria e Móveis",
  "Ar-condicionado",
  "Jardinagem",
  "Mudanças e Fretes",
  "Informática e TI",
  "Segurança e Câmeras",
  "Manutenção Geral",
  "Beleza e Estética",
  "Aulas Particulares",
  "Culinária e Buffet",
  "Pet Care",
  "Outro",
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProviderRegisterScreen() {
  const insets = useSafeAreaInsets();
  const { registerProvider } = useApp();

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showSpecialties, setShowSpecialties] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // validation
  function validate() {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().split(" ").length < 2)
      e.fullName = "Informe nome e sobrenome";
    if (!validateCPF(cpf)) e.cpf = "CPF inválido";
    const age = calcAge(birthDate);
    if (!age || age < 18) e.birthDate = "Você precisa ter pelo menos 18 anos";
    if (age && age > 120) e.birthDate = "Data de nascimento inválida";
    if (phone.replace(/\D/g, "").length < 10) e.phone = "Telefone inválido";
    if (!specialty) e.specialty = "Selecione uma área de atuação";
    if (!city.trim()) e.city = "Informe a cidade";
    if (!neighborhood.trim()) e.neighborhood = "Informe o bairro";
    if (!acceptedTerms) e.terms = "Aceite os termos para continuar";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubmitting(true);
    try {
      await registerProvider({
        fullName: fullName.trim(),
        cpf,
        birthDate,
        phone,
        specialty,
        city: city.trim(),
        neighborhood: neighborhood.trim(),
        acceptedTerms,
      });
      // Go back to provider tab
      router.replace("/(tabs)/provider");
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o cadastro. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <SoliciteLogo size="sm" />
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleBlock}>
          <View style={styles.titleIconBox}>
            <Ionicons name="person-add" size={28} color="#0A0A0F" />
          </View>
          <Text style={styles.title}>Cadastro de Prestador</Text>
          <Text style={styles.subtitle}>
            Preencha seus dados para começar a oferecer serviços na plataforma
          </Text>
        </View>

        {/* ── Security notice ── */}
        <View style={styles.securityNotice}>
          <View style={styles.securityHeader}>
            <View style={styles.securityIconBox}>
              <Ionicons name="shield-checkmark" size={20} color={C.primary} />
            </View>
            <Text style={styles.securityTitle}>Por que pedimos seus dados?</Text>
          </View>
          <Text style={styles.securityBody}>
            A SOLICITE verifica a identidade de todos os prestadores para garantir
            a segurança dos clientes e da comunidade. Seus dados pessoais são
            protegidos por criptografia, nunca compartilhados com terceiros e
            usados exclusivamente para validação de identidade.
          </Text>
          <View style={styles.securityPoints}>
            {[
              { icon: "lock-closed-outline", text: "Dados protegidos por criptografia" },
              { icon: "eye-off-outline",     text: "Não compartilhamos com terceiros" },
              { icon: "people-outline",      text: "Plataforma segura para todos" },
            ].map((p) => (
              <View key={p.icon} style={styles.securityPoint}>
                <Ionicons name={p.icon as any} size={13} color={C.primary} />
                <Text style={styles.securityPointText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Form ── */}
        <Text style={styles.sectionLabel}>DADOS PESSOAIS</Text>

        <Field label="Nome completo" icon="person-outline" error={errors.fullName} required>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Ex: Maria da Silva"
            placeholderTextColor={C.textTertiary}
            value={fullName}
            onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, fullName: "" })); }}
            autoCapitalize="words"
          />
        </Field>

        <Field label="CPF" icon="card-outline" error={errors.cpf} required>
          <TextInput
            style={[styles.input, errors.cpf && styles.inputError]}
            placeholder="000.000.000-00"
            placeholderTextColor={C.textTertiary}
            value={cpf}
            onChangeText={(t) => { setCpf(formatCPF(t)); setErrors((e) => ({ ...e, cpf: "" })); }}
            keyboardType="numeric"
            maxLength={14}
          />
        </Field>

        <Field label="Data de nascimento" icon="calendar-outline" error={errors.birthDate} required>
          <TextInput
            style={[styles.input, errors.birthDate && styles.inputError]}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={C.textTertiary}
            value={birthDate}
            onChangeText={(t) => { setBirthDate(formatDate(t)); setErrors((e) => ({ ...e, birthDate: "" })); }}
            keyboardType="numeric"
            maxLength={10}
          />
          {birthDate.length === 10 && calcAge(birthDate) !== null && (calcAge(birthDate)! >= 18) && (
            <Text style={styles.agePill}>
              <Ionicons name="checkmark-circle" size={12} color={C.success} /> {calcAge(birthDate)} anos
            </Text>
          )}
        </Field>

        <Field label="Telefone / WhatsApp" icon="call-outline" error={errors.phone} required>
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="(62) 99999-9999"
            placeholderTextColor={C.textTertiary}
            value={phone}
            onChangeText={(t) => { setPhone(formatPhone(t)); setErrors((e) => ({ ...e, phone: "" })); }}
            keyboardType="phone-pad"
            maxLength={15}
          />
        </Field>

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>ÁREA DE ATUAÇÃO</Text>

        <Field label="Especialidade" icon="briefcase-outline" error={errors.specialty} required>
          <Pressable
            style={[styles.selector, errors.specialty && styles.inputError]}
            onPress={() => setShowSpecialties((v) => !v)}
          >
            <Text style={specialty ? styles.selectorValue : styles.selectorPlaceholder}>
              {specialty || "Selecione sua área"}
            </Text>
            <Ionicons
              name={showSpecialties ? "chevron-up" : "chevron-down"}
              size={16}
              color={C.textSecondary}
            />
          </Pressable>
          {showSpecialties && (
            <View style={styles.dropdownList}>
              {SPECIALTIES.map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.dropdownItem,
                    specialty === s && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setSpecialty(s);
                    setShowSpecialties(false);
                    setErrors((e) => ({ ...e, specialty: "" }));
                  }}
                >
                  {specialty === s && (
                    <Ionicons name="checkmark-circle" size={14} color={C.primary} />
                  )}
                  <Text style={[
                    styles.dropdownItemText,
                    specialty === s && { color: C.primary },
                  ]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Field>

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>LOCALIZAÇÃO</Text>

        <Field label="Cidade" icon="location-outline" error={errors.city} required>
          <TextInput
            style={[styles.input, errors.city && styles.inputError]}
            placeholder="Ex: Goiânia"
            placeholderTextColor={C.textTertiary}
            value={city}
            onChangeText={(t) => { setCity(t); setErrors((e) => ({ ...e, city: "" })); }}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Bairro" icon="map-outline" error={errors.neighborhood} required>
          <TextInput
            style={[styles.input, errors.neighborhood && styles.inputError]}
            placeholder="Ex: Setor Bueno"
            placeholderTextColor={C.textTertiary}
            value={neighborhood}
            onChangeText={(t) => { setNeighborhood(t); setErrors((e) => ({ ...e, neighborhood: "" })); }}
            autoCapitalize="words"
          />
        </Field>

        {/* ── Terms ── */}
        <Pressable
          style={[styles.termsRow, errors.terms && styles.termsRowError]}
          onPress={() => {
            setAcceptedTerms((v) => !v);
            setErrors((e) => ({ ...e, terms: "" }));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms && <Ionicons name="checkmark" size={14} color="#000" />}
          </View>
          <Text style={styles.termsText}>
            Declaro que as informações fornecidas são verdadeiras e concordo com os{" "}
            <Text style={{ color: C.primary }}>Termos de Uso</Text> e a{" "}
            <Text style={{ color: C.primary }}>Política de Privacidade</Text> da SOLICITE
          </Text>
        </Pressable>
        {errors.terms ? (
          <View style={[styles.errorRow, { marginTop: -8, marginBottom: 4 }]}>
            <Ionicons name="alert-circle-outline" size={12} color={C.danger} />
            <Text style={styles.errorText}>{errors.terms}</Text>
          </View>
        ) : null}

        {/* ── Submit ── */}
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            pressed && { opacity: 0.85 },
            submitting && { opacity: 0.6 },
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <Text style={styles.submitText}>Salvando...</Text>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
              <Text style={styles.submitText}>Concluir Cadastro</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footnote}>
          * Campos obrigatórios. Seus dados são criptografados e protegidos pela SOLICITE.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    padding: 20,
    gap: 16,
  },

  titleBlock: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  titleIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Security notice
  securityNotice: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.primary,
    padding: 16,
    gap: 12,
    shadowColor: C.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  securityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.primaryGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  securityTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.primary,
    flex: 1,
  },
  securityBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 19,
  },
  securityPoints: { gap: 8 },
  securityPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  securityPointText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: C.textTertiary,
    letterSpacing: 1.5,
    marginBottom: -4,
  },

  // Field
  field: { gap: 8 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  inputError: {
    borderColor: C.danger,
  },
  agePill: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.success,
    marginTop: -4,
  },

  // Error
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.danger,
  },

  // Specialty selector
  selector: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorValue: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    flex: 1,
  },
  selectorPlaceholder: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    flex: 1,
  },
  dropdownList: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginTop: -4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dropdownItemActive: { backgroundColor: C.primaryGlow },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },

  // Terms
  termsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  termsRowError: { borderColor: C.danger },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 19,
  },

  // Submit
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: C.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    marginTop: 8,
  },
  submitText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },

  footnote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    textAlign: "center",
    lineHeight: 16,
  },
});
