import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { Service, ServiceStatus } from "@/context/AppContext";

const C = Colors.dark;

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; color: string; icon: string }
> = {
  pending_payment: { label: "Aguardando Pagamento", color: C.warning, icon: "clock" },
  available:       { label: "Disponível no Global",  color: C.primary, icon: "globe" },
  accepted:        { label: "Aceito pelo Prestador", color: C.accent,  icon: "user-check" },
  in_progress:     { label: "Em Andamento",          color: C.primary, icon: "tool" },
  completed:       { label: "Finalizado",             color: C.success, icon: "check-circle" },
  rated:           { label: "Concluído",              color: C.textSecondary, icon: "award" },
};

function StarRating({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(star);
          }}
        >
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? C.gold : C.textMuted}
          />
        </Pressable>
      ))}
    </View>
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
        <Feather
          name={icon as any}
          size={13}
          color={focused ? C.primary : C.textTertiary}
        />
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

function ServiceStatusCard({
  service,
  onPay,
  onConfirmAndRate,
}: {
  service: Service;
  onPay: () => void;
  onConfirmAndRate: () => void;
}) {
  const cfg = STATUS_CONFIG[service.status];
  const isUrgent = service.urgent;

  return (
    <View
      style={[
        styles.serviceCard,
        isUrgent && service.status === "pending_payment" && styles.serviceCardUrgent,
      ]}
    >
      <View style={styles.serviceCardRow}>
        <View style={styles.serviceCardTitleArea}>
          <Text style={styles.serviceCardTitle} numberOfLines={1}>
            {service.title}
          </Text>
          <View style={styles.serviceCardMeta}>
            <Feather name="map-pin" size={11} color={C.textTertiary} />
            <Text style={styles.serviceCardMetaText}>
              {service.neighborhood}, {service.city}
            </Text>
          </View>
        </View>
        <View style={styles.serviceCardValueArea}>
          <Text style={[styles.serviceCardValue, isUrgent && { color: C.danger }]}>
            R$ {service.finalValue.toFixed(2)}
          </Text>
          {isUrgent && (
            <View style={styles.urgentTag}>
              <Ionicons name="flash" size={10} color={C.danger} />
              <Text style={styles.urgentTagText}>URGENTE</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.statusBadge, { borderColor: cfg.color }]}>
        <Feather name={cfg.icon as any} size={12} color={cfg.color} />
        <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
          {cfg.label}
        </Text>
      </View>

      {service.status === "pending_payment" && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: C.warning },
            pressed && styles.actionButtonPressed,
          ]}
          onPress={onPay}
        >
          <Ionicons name="card" size={16} color="#000" />
          <Text style={styles.actionButtonText}>Pagar Agora</Text>
        </Pressable>
      )}

      {service.status === "completed" && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: C.primary },
            pressed && styles.actionButtonPressed,
          ]}
          onPress={onConfirmAndRate}
        >
          <Ionicons name="checkmark-done" size={16} color="#000" />
          <Text style={styles.actionButtonText}>Confirmar Pagamento e Avaliar</Text>
        </Pressable>
      )}

      {service.status === "rated" && service.clientRating !== undefined && (
        <View style={styles.ratedRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= service.clientRating! ? "star" : "star-outline"}
              size={16}
              color={s <= service.clientRating! ? C.gold : C.textMuted}
            />
          ))}
          <Text style={styles.ratedText}>Sua avaliação</Text>
        </View>
      )}
    </View>
  );
}

export default function SolicitacoesScreen() {
  const insets = useSafeAreaInsets();
  const { services, createService, confirmPayment, confirmAndRate, URGENT_FEE, PLATFORM_FEE_RATE, provider } = useApp();

  const [activeTab, setActiveTab] = useState<"nova" | "meus">("nova");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [city] = useState("Goiânia");
  const [neighborhood, setNeighborhood] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [formStep, setFormStep] = useState<"form" | "payment" | "success">("form");
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);

  // Rating modal
  const [ratingModal, setRatingModal] = useState<{
    service: Service;
  } | null>(null);
  const [rating, setRating] = useState(0);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    fee: number;
    providerEarning: number;
    platformFeeApplied: boolean;
  } | null>(null);

  const numericValue = parseFloat(value.replace(",", ".")) || 0;
  const finalValue = urgent ? numericValue + URGENT_FEE : numericValue;

  const myServices = [...services].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const pendingCount = myServices.filter(
    (s) => s.status === "pending_payment" || s.status === "completed"
  ).length;

  const handleCreate = async () => {
    if (
      !title.trim() ||
      !description.trim() ||
      !value.trim() ||
      !neighborhood.trim()
    ) {
      Alert.alert("Campos obrigatórios", "Preencha todos os campos.");
      return;
    }
    if (numericValue <= 0) {
      Alert.alert("Valor inválido", "Informe um valor válido.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);
    try {
      const svc = await createService({
        title: title.trim(),
        description: description.trim(),
        value: numericValue,
        city,
        neighborhood: neighborhood.trim(),
        urgent,
      });
      setPendingServiceId(svc.id);
      setFormStep("payment");
    } finally {
      setCreating(false);
    }
  };

  const handlePay = async (serviceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1500));
    await confirmPayment(serviceId);
    setPaying(false);
    if (serviceId === pendingServiceId) {
      setFormStep("success");
    }
  };

  const handleOpenRating = (service: Service) => {
    setRating(0);
    setPaymentResult(null);
    setRatingModal({ service });
  };

  const handleConfirmAndRate = async () => {
    if (!ratingModal || rating === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirmingPayment(true);
    const result = await confirmAndRate(ratingModal.service.id, rating);
    setConfirmingPayment(false);
    if (result) {
      setPaymentResult(result);
    }
  };

  const handleReset = () => {
    setTitle("");
    setDescription("");
    setValue("");
    setNeighborhood("");
    setUrgent(false);
    setPendingServiceId(null);
    setFormStep("form");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Solicitações</Text>
          <Text style={styles.headerSubtitle}>
            Crie e acompanhe seus serviços
          </Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabSwitcher}>
          <Pressable
            style={[styles.tabBtn, activeTab === "nova" && styles.tabBtnActive]}
            onPress={() => setActiveTab("nova")}
          >
            <Feather
              name="plus-circle"
              size={14}
              color={activeTab === "nova" ? "#000" : C.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "nova" && styles.tabBtnTextActive,
              ]}
            >
              Nova Solicitação
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === "meus" && styles.tabBtnActive]}
            onPress={() => setActiveTab("meus")}
          >
            <Feather
              name="list"
              size={14}
              color={activeTab === "meus" ? "#000" : C.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "meus" && styles.tabBtnTextActive,
              ]}
            >
              Meus Serviços
              {myServices.length > 0 && ` (${myServices.length})`}
            </Text>
            {pendingCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── NOVA SOLICITAÇÃO ── */}
        {activeTab === "nova" && (
          <>
            {formStep === "form" && (
              <View style={styles.card}>
                <InputField
                  label="Título do Serviço"
                  placeholder="Ex: Instalação de ar condicionado"
                  value={title}
                  onChangeText={setTitle}
                  icon="file-text"
                />
                <InputField
                  label="Descrição"
                  placeholder="Descreva detalhes do serviço..."
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
                      <Feather name="map-pin" size={13} color={C.textTertiary} />
                      <Text style={styles.inputLabel}>Cidade</Text>
                    </View>
                    <View style={[styles.input, { opacity: 0.5 }]}>
                      <Text style={{ color: C.textSecondary, fontFamily: "Inter_400Regular" }}>
                        {city}
                      </Text>
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

                {/* Urgência */}
                <Pressable
                  style={styles.urgentToggle}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setUrgent(!urgent);
                  }}
                >
                  <View style={styles.urgentLeft}>
                    <View style={[styles.urgentIcon, urgent && styles.urgentIconActive]}>
                      <Ionicons name="flash" size={18} color={urgent ? "#fff" : C.textTertiary} />
                    </View>
                    <View>
                      <Text style={styles.urgentTitle}>Serviço Urgente</Text>
                      <Text style={styles.urgentSub}>
                        +R$ {URGENT_FEE.toFixed(2)} ao valor
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.checkbox, urgent && styles.checkboxActive]}>
                    {urgent && <Feather name="check" size={14} color="#fff" />}
                  </View>
                </Pressable>

                {numericValue > 0 && (
                  <View style={styles.summary}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Valor base</Text>
                      <Text style={styles.summaryValue}>R$ {numericValue.toFixed(2)}</Text>
                    </View>
                    {urgent && (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: C.danger }]}>Taxa urgência</Text>
                        <Text style={[styles.summaryValue, { color: C.danger }]}>
                          +R$ {URGENT_FEE.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                      <Text style={styles.summaryTotalLabel}>Total</Text>
                      <Text style={styles.summaryTotalValue}>R$ {finalValue.toFixed(2)}</Text>
                    </View>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                  ]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Feather name="send" size={17} color="#000" />
                      <Text style={styles.primaryBtnText}>Criar Solicitação</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {formStep === "payment" && pendingServiceId && (
              <PaymentScreen
                service={services.find((s) => s.id === pendingServiceId)!}
                paying={paying}
                onPay={() => handlePay(pendingServiceId)}
              />
            )}

            {formStep === "success" && (
              <View style={styles.successCard}>
                <View style={styles.successIconWrap}>
                  <Ionicons name="checkmark-circle" size={56} color={C.success} />
                </View>
                <Text style={styles.successTitle}>Publicado com sucesso!</Text>
                <Text style={styles.successSub}>
                  Seu serviço está disponível no Mercado Global. Prestadores da
                  sua região já podem ver e aceitar.
                </Text>
                <View style={styles.successBadges}>
                  <View style={styles.badge}>
                    <Feather name="map-pin" size={11} color={C.primary} />
                    <Text style={styles.badgeText}>{city}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Feather name="navigation" size={11} color={C.primary} />
                    <Text style={styles.badgeText}>{neighborhood}</Text>
                  </View>
                  {urgent && (
                    <View style={[styles.badge, { borderColor: C.danger }]}>
                      <Ionicons name="flash" size={11} color={C.danger} />
                      <Text style={[styles.badgeText, { color: C.danger }]}>Urgente</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={handleReset}
                >
                  <Feather name="plus" size={16} color={C.primary} />
                  <Text style={styles.outlineBtnText}>Nova Solicitação</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setActiveTab("meus")}
                >
                  <Text style={styles.ghostBtnText}>Ver Meus Serviços</Text>
                  <Feather name="arrow-right" size={14} color={C.textSecondary} />
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* ── MEUS SERVIÇOS ── */}
        {activeTab === "meus" && (
          <View style={styles.myServicesSection}>
            {myServices.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="inbox" size={36} color={C.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Nenhum serviço ainda</Text>
                <Text style={styles.emptySub}>
                  Crie sua primeira solicitação na aba "Nova Solicitação"
                </Text>
              </View>
            ) : (
              myServices.map((svc) => (
                <ServiceStatusCard
                  key={svc.id}
                  service={svc}
                  onPay={() => handlePay(svc.id)}
                  onConfirmAndRate={() => handleOpenRating(svc)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={ratingModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!confirmingPayment && !paymentResult) setRatingModal(null);
        }}
      >
        {ratingModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {!paymentResult ? (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Confirmar Pagamento</Text>
                    <Pressable
                      onPress={() => setRatingModal(null)}
                      style={styles.modalCloseBtn}
                    >
                      <Feather name="x" size={20} color={C.textSecondary} />
                    </Pressable>
                  </View>

                  <Text style={styles.modalServiceName} numberOfLines={1}>
                    {ratingModal.service.title}
                  </Text>

                  <View style={styles.feeBox}>
                    <View style={styles.feeRow}>
                      <Text style={styles.feeLabel}>Valor do serviço</Text>
                      <Text style={styles.feeValue}>
                        R$ {ratingModal.service.finalValue.toFixed(2)}
                      </Text>
                    </View>
                    {provider.plan === "free" && (
                      <View style={styles.feeRow}>
                        <Text style={[styles.feeLabel, { color: C.danger }]}>
                          Taxa da plataforma (10%)
                        </Text>
                        <Text style={[styles.feeValue, { color: C.danger }]}>
                          -R$ {(ratingModal.service.finalValue * PLATFORM_FEE_RATE).toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.feeRow, styles.feeTotalRow]}>
                      <Text style={styles.feeTotalLabel}>Prestador recebe</Text>
                      <Text style={styles.feeTotalValue}>
                        R${" "}
                        {(
                          ratingModal.service.finalValue *
                          (provider.plan === "free" ? 1 - PLATFORM_FEE_RATE : 1)
                        ).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ratingSection}>
                    <Text style={styles.ratingSectionTitle}>Avalie o Prestador</Text>
                    <Text style={styles.ratingSectionSub}>
                      Como foi o serviço prestado?
                    </Text>
                    <StarRating value={rating} onChange={setRating} size={40} />
                    <Text style={styles.ratingHint}>
                      {rating === 0
                        ? "Toque nas estrelas para avaliar"
                        : rating === 1
                        ? "Muito ruim"
                        : rating === 2
                        ? "Ruim"
                        : rating === 3
                        ? "Regular"
                        : rating === 4
                        ? "Bom"
                        : "Excelente!"}
                    </Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      rating === 0 && { opacity: 0.4 },
                      pressed && styles.primaryBtnPressed,
                    ]}
                    onPress={handleConfirmAndRate}
                    disabled={rating === 0 || confirmingPayment}
                  >
                    {confirmingPayment ? (
                      <>
                        <ActivityIndicator color="#000" />
                        <Text style={styles.primaryBtnText}>Processando...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={17} color="#000" />
                        <Text style={styles.primaryBtnText}>
                          Confirmar Pagamento e Avaliar
                        </Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <View style={styles.paymentSuccess}>
                  <View style={styles.paymentSuccessIcon}>
                    <Ionicons name="checkmark-circle" size={64} color={C.success} />
                  </View>
                  <Text style={styles.paymentSuccessTitle}>Tudo certo!</Text>
                  <Text style={styles.paymentSuccessSub}>
                    Pagamento confirmado e avaliação enviada.
                  </Text>
                  <View style={styles.earningsBox}>
                    <Text style={styles.earningsLabel}>Prestador recebeu</Text>
                    <Text style={styles.earningsValue}>
                      R$ {paymentResult.providerEarning.toFixed(2)}
                    </Text>
                    {paymentResult.platformFeeApplied && (
                      <Text style={styles.earningsFee}>
                        (Taxa da plataforma: R$ {paymentResult.fee.toFixed(2)})
                      </Text>
                    )}
                    {!paymentResult.platformFeeApplied && (
                      <Text style={[styles.earningsFee, { color: C.success }]}>
                        Sem taxa — plano ativo
                      </Text>
                    )}
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && styles.primaryBtnPressed,
                    ]}
                    onPress={() => {
                      setRatingModal(null);
                      setPaymentResult(null);
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Fechar</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PaymentScreen({
  service,
  paying,
  onPay,
}: {
  service: Service | undefined;
  paying: boolean;
  onPay: () => void;
}) {
  if (!service) return null;
  return (
    <View style={styles.card}>
      <View style={styles.paymentIconWrap}>
        <Ionicons name="card-outline" size={44} color={C.primary} />
      </View>
      <Text style={styles.paymentTitle}>Confirme o Pagamento</Text>
      <Text style={styles.paymentSub}>
        Após o pagamento, sua solicitação ficará disponível no Mercado Global
      </Text>

      <View style={styles.paymentDetail}>
        <Row label="Serviço" value={service.title} />
        <Row label="Cidade" value={service.city} />
        <Row label="Bairro" value={service.neighborhood} />
        {service.urgent && (
          <Row label="Urgência" value="Sim" valueColor={C.danger} />
        )}
        <View style={[styles.summaryRow, styles.summaryTotal, { marginTop: 4 }]}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>
            R$ {service.finalValue.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.paymentMethods}>
        {["Cartão de Crédito", "PIX", "Boleto"].map((m, i) => (
          <View
            key={m}
            style={[
              styles.paymentMethod,
              i === 0 && styles.paymentMethodSelected,
            ]}
          >
            <Text
              style={[
                styles.paymentMethodText,
                i === 0 && { color: C.primary },
              ]}
            >
              {m}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: C.warning },
          pressed && styles.primaryBtnPressed,
        ]}
        onPress={onPay}
        disabled={paying}
      >
        {paying ? (
          <>
            <ActivityIndicator color="#000" />
            <Text style={styles.primaryBtnText}>Processando...</Text>
          </>
        ) : (
          <>
            <Ionicons name="lock-closed" size={17} color="#000" />
            <Text style={styles.primaryBtnText}>
              Pagar Agora — R$ {service.finalValue.toFixed(2)}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[styles.summaryValue, valueColor && { color: valueColor }]}
        numberOfLines={1}
      >
        {value}
      </Text>
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
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: C.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  tabBtnTextActive: {
    color: "#000",
  },
  tabBadge: {
    backgroundColor: C.danger,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  card: {
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
    gap: 7,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
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
    height: 96,
    paddingTop: 13,
  },
  inputFocused: {
    borderColor: C.primary,
  },
  urgentToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  urgentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  urgentIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
  urgentSub: {
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
  summary: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    maxWidth: "55%",
    textAlign: "right",
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 2,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.primary,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
  },
  outlineBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  ghostBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  successCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
  },
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.successLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.success,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  successSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  successBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.primaryGlow,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.primary,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  myServicesSection: {
    paddingHorizontal: 16,
    gap: 12,
  },
  serviceCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  serviceCardUrgent: {
    borderColor: C.danger,
  },
  serviceCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  serviceCardTitleArea: {
    flex: 1,
    gap: 4,
  },
  serviceCardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  serviceCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  serviceCardMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  serviceCardValueArea: {
    alignItems: "flex-end",
    gap: 4,
  },
  serviceCardValue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: C.primary,
  },
  urgentTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: C.dangerLight,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  urgentTagText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: C.danger,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  ratedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratedText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 14,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 24,
  },
  paymentIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: C.primaryGlow,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  paymentTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
    textAlign: "center",
  },
  paymentSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  paymentDetail: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  paymentMethods: {
    flexDirection: "row",
    gap: 8,
  },
  paymentMethod: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 18,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalServiceName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  feeBox: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feeLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  feeValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  feeTotalRow: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 2,
  },
  feeTotalLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  feeTotalValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  ratingSection: {
    alignItems: "center",
    gap: 10,
  },
  ratingSectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  ratingSectionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  ratingHint: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    marginTop: 4,
  },
  paymentSuccess: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  paymentSuccessIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.successLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.success,
  },
  paymentSuccessTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  paymentSuccessSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },
  earningsBox: {
    alignItems: "center",
    gap: 4,
    backgroundColor: C.successLight,
    borderRadius: 14,
    padding: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: C.success,
  },
  earningsLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  earningsValue: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  earningsFee: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
});
