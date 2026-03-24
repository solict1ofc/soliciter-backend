import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

const C = Colors.dark;

export default function SolicitacoesScreen() {
  const insets = useSafeAreaInsets();
  const { createService, confirmPayment, URGENT_FEE } = useApp();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [city] = useState("Goiânia");
  const [neighborhood, setNeighborhood] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);

  const numericValue = parseFloat(value.replace(",", ".")) || 0;
  const finalValue = urgent ? numericValue + URGENT_FEE : numericValue;

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !value.trim() || !neighborhood.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha todos os campos antes de continuar.");
      return;
    }
    if (numericValue <= 0) {
      Alert.alert("Valor inválido", "Informe um valor válido para o serviço.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const service = await createService({
        title: title.trim(),
        description: description.trim(),
        value: numericValue,
        city,
        neighborhood: neighborhood.trim(),
        urgent,
      });
      setCreatedServiceId(service.id);
      setStep("payment");
    } catch (e) {
      Alert.alert("Erro", "Não foi possível criar a solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!createdServiceId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    await confirmPayment(createdServiceId);
    setLoading(false);
    setStep("success");
  };

  const handleReset = () => {
    setTitle("");
    setDescription("");
    setValue("");
    setNeighborhood("");
    setUrgent(false);
    setCreatedServiceId(null);
    setStep("form");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nova Solicitação</Text>
          <Text style={styles.headerSubtitle}>
            Publique seu serviço e encontre prestadores qualificados
          </Text>
        </View>

        {step === "form" && (
          <View style={styles.formCard}>
            <InputField
              label="Título do Serviço"
              placeholder="Ex: Instalação de ar condicionado"
              value={title}
              onChangeText={setTitle}
              icon="file-text"
            />

            <InputField
              label="Descrição"
              placeholder="Descreva o serviço em detalhes..."
              value={description}
              onChangeText={setDescription}
              icon="align-left"
              multiline
              numberOfLines={4}
            />

            <InputField
              label="Valor (R$)"
              placeholder="0,00"
              value={value}
              onChangeText={setValue}
              icon="dollar-sign"
              keyboardType="numeric"
            />

            <View style={styles.row}>
              <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
                <View style={styles.inputHeader}>
                  <Feather name="map-pin" size={14} color={C.primary} />
                  <Text style={styles.inputLabel}>Cidade</Text>
                </View>
                <View style={[styles.input, styles.disabledInput]}>
                  <Text style={styles.disabledText}>{city}</Text>
                </View>
              </View>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <InputField
                  label="Bairro"
                  placeholder="Seu bairro"
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  icon="navigation"
                />
              </View>
            </View>

            <Pressable
              style={styles.urgentToggle}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setUrgent(!urgent);
              }}
            >
              <View style={styles.urgentLeft}>
                <View style={[styles.urgentIcon, urgent && styles.urgentIconActive]}>
                  <Ionicons
                    name="flash"
                    size={18}
                    color={urgent ? "#fff" : C.textTertiary}
                  />
                </View>
                <View>
                  <Text style={styles.urgentTitle}>Serviço Urgente</Text>
                  <Text style={styles.urgentSubtitle}>
                    Adiciona +R${URGENT_FEE.toFixed(2)} ao valor
                  </Text>
                </View>
              </View>
              <View style={[styles.checkbox, urgent && styles.checkboxActive]}>
                {urgent && <Feather name="check" size={14} color="#fff" />}
              </View>
            </Pressable>

            {numericValue > 0 && (
              <View style={styles.valueSummary}>
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>Valor base</Text>
                  <Text style={styles.valueAmount}>
                    R$ {numericValue.toFixed(2)}
                  </Text>
                </View>
                {urgent && (
                  <View style={styles.valueRow}>
                    <Text style={[styles.valueLabel, { color: C.danger }]}>
                      Taxa urgência
                    </Text>
                    <Text style={[styles.valueAmount, { color: C.danger }]}>
                      +R$ {URGENT_FEE.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={[styles.valueRow, styles.valueTotal]}>
                  <Text style={styles.valueTotalLabel}>Total</Text>
                  <Text style={styles.valueTotalAmount}>
                    R$ {finalValue.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
              ]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#000" />
                  <Text style={styles.submitButtonText}>Criar Solicitação</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {step === "payment" && (
          <View style={styles.paymentCard}>
            <View style={styles.paymentIcon}>
              <Ionicons name="card-outline" size={48} color={C.primary} />
            </View>
            <Text style={styles.paymentTitle}>Pagamento</Text>
            <Text style={styles.paymentSubtitle}>
              Confirme o pagamento para publicar seu serviço
            </Text>

            <View style={styles.paymentDetails}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Serviço</Text>
                <Text style={styles.paymentValue} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Cidade</Text>
                <Text style={styles.paymentValue}>{city}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Bairro</Text>
                <Text style={styles.paymentValue}>{neighborhood}</Text>
              </View>
              {urgent && (
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: C.danger }]}>
                    Urgência
                  </Text>
                  <Text style={[styles.paymentValue, { color: C.danger }]}>
                    Sim
                  </Text>
                </View>
              )}
              <View style={[styles.paymentRow, styles.paymentTotal]}>
                <Text style={styles.paymentTotalLabel}>Total</Text>
                <Text style={styles.paymentTotalValue}>
                  R$ {finalValue.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.paymentMethods}>
              {["Cartão de Crédito", "PIX", "Boleto"].map((method, i) => (
                <Pressable
                  key={method}
                  style={[
                    styles.paymentMethod,
                    i === 0 && styles.paymentMethodSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentMethodText,
                      i === 0 && styles.paymentMethodTextSelected,
                    ]}
                  >
                    {method}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
              ]}
              onPress={handlePayment}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#000" />
                  <Text style={styles.submitButtonText}>Processando...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="lock-closed" size={18} color="#000" />
                  <Text style={styles.submitButtonText}>Pagar R$ {finalValue.toFixed(2)}</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {step === "success" && (
          <View style={styles.successCard}>
            <View style={styles.successIconWrapper}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={48} color={C.success} />
              </View>
            </View>
            <Text style={styles.successTitle}>Publicado!</Text>
            <Text style={styles.successSubtitle}>
              Seu serviço foi publicado com sucesso. Prestadores da região
              poderão aceitar sua solicitação.
            </Text>
            <View style={styles.successBadges}>
              <View style={styles.successBadge}>
                <Feather name="map-pin" size={12} color={C.primary} />
                <Text style={styles.successBadgeText}>{city}</Text>
              </View>
              <View style={styles.successBadge}>
                <Feather name="navigation" size={12} color={C.primary} />
                <Text style={styles.successBadgeText}>{neighborhood}</Text>
              </View>
              {urgent && (
                <View style={[styles.successBadge, { borderColor: C.danger }]}>
                  <Ionicons name="flash" size={12} color={C.danger} />
                  <Text style={[styles.successBadgeText, { color: C.danger }]}>
                    Urgente
                  </Text>
                </View>
              )}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.newServiceButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleReset}
            >
              <Feather name="plus" size={18} color={C.primary} />
              <Text style={styles.newServiceButtonText}>Nova Solicitação</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  multiline,
  numberOfLines,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  icon: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputWrapper}>
      <View style={styles.inputHeader}>
        <Feather name={icon as any} size={14} color={focused ? C.primary : C.textTertiary} />
        <Text style={[styles.inputLabel, focused && { color: C.primary }]}>
          {label}
        </Text>
      </View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
        ]}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType || "default"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 20,
  },
  formCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: "row",
  },
  inputWrapper: {
    gap: 8,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputMultiline: {
    height: 100,
    paddingTop: 13,
  },
  inputFocused: {
    borderColor: C.primary,
    backgroundColor: C.backgroundSecondary,
  },
  disabledInput: {
    opacity: 0.5,
  },
  disabledText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  urgentToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  urgentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  urgentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentIconActive: {
    backgroundColor: C.danger,
  },
  urgentTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  urgentSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  valueSummary: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  valueLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  valueAmount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  valueTotal: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 2,
  },
  valueTotalLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  valueTotalAmount: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.primary,
  },
  submitButton: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  paymentCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
  },
  paymentIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.primaryGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  paymentSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  paymentDetails: {
    width: "100%",
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  paymentValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    maxWidth: "60%",
    textAlign: "right",
  },
  paymentTotal: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    marginTop: 4,
  },
  paymentTotalLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  paymentTotalValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.primary,
  },
  paymentMethods: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  paymentMethod: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.backgroundTertiary,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  paymentMethodSelected: {
    backgroundColor: C.primaryGlow,
    borderColor: C.primary,
  },
  paymentMethodText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  paymentMethodTextSelected: {
    color: C.primary,
  },
  successCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
  },
  successIconWrapper: {
    padding: 4,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.successLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.success,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  successBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primaryGlow,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.primary,
  },
  successBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  newServiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.primary,
    marginTop: 8,
  },
  newServiceButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
});
