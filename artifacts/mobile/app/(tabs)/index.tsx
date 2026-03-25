import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useAuth } from "@/context/AuthContext";
import LocationPicker from "@/components/LocationPicker";
import { SoliciteLogo } from "@/components/SoliciteLogo";

const C = Colors.dark;

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending_payment: { label: "Aguardando Pagamento",   color: C.warning,       icon: "card-outline" },
  available:       { label: "Disponível no Global",   color: C.primary,       icon: "globe-outline" },
  accepted:        { label: "Aceito pelo Prestador",  color: C.accent,        icon: "person-add-outline" },
  in_progress:     { label: "Em Andamento",           color: "#FF9500",       icon: "construct-outline" },
  completed:       { label: "Concluído — Confirmar",  color: C.success,       icon: "checkmark-circle-outline" },
  rated:           { label: "Concluído",              color: C.textSecondary, icon: "ribbon-outline" },
};

// ─── Step progress bar ───────────────────────────────────────────────────────
function StepBar({ step }: { step: "form" | "payment" | "success" }) {
  const steps = ["Dados", "Pagamento", "Publicado"];
  const active = step === "form" ? 0 : step === "payment" ? 1 : 2;
  return (
    <View style={styles.stepBar}>
      {steps.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <React.Fragment key={i}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#000" />
                ) : (
                  <Text style={[styles.stepNum, current && { color: "#000" }]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, (done || current) && { color: C.text }]}>{label}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Star rating ─────────────────────────────────────────────────────────────
function StarRating({ value, onChange, size = 36 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(star); }}
          hitSlop={10}
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

// ─── Input field ─────────────────────────────────────────────────────────────
function InputField({
  label, placeholder, value, onChangeText, icon,
  multiline, numberOfLines, keyboardType,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; icon: keyof typeof Ionicons.glyphMap;
  multiline?: boolean; numberOfLines?: number; keyboardType?: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputWrapper}>
      <View style={styles.inputHeader}>
        <Ionicons name={icon} size={13} color={focused ? C.primary : C.textTertiary} />
        <Text style={[styles.inputLabel, focused && { color: C.primary }]}>{label}</Text>
      </View>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, focused && styles.inputFocused]}
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

// ─── Service card ─────────────────────────────────────────────────────────────
function ServiceStatusCard({
  service, onConfirmAndRate,
}: {
  service: Service; onConfirmAndRate: () => void;
}) {
  const cfg = STATUS_CONFIG[service.status];

  return (
    <View style={[styles.serviceCard, service.urgent && styles.serviceCardUrgent]}>
      <View style={styles.serviceCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.serviceCardTitle} numberOfLines={1}>{service.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={11} color={C.textTertiary} />
            <Text style={styles.metaText}>{service.neighborhood}, {service.city}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[styles.serviceCardValue, service.urgent && { color: C.danger }]}>
            R$ {service.finalValue.toFixed(2)}
          </Text>
          {service.urgent && (
            <View style={styles.urgentTag}>
              <Ionicons name="flash" size={10} color={C.danger} />
              <Text style={styles.urgentTagText}>URGENTE</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: cfg.color + "20", borderColor: cfg.color }]}>
        <Ionicons name={cfg.icon} size={13} color={cfg.color} />
        <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {service.status === "accepted" && (
        <View style={styles.infoNote}>
          <Ionicons name="person-circle-outline" size={16} color={C.accent} />
          <Text style={styles.infoNoteText}>Prestador aceitou — aguardando ele iniciar</Text>
        </View>
      )}
      {service.status === "in_progress" && (
        <View style={styles.infoNote}>
          <Ionicons name="construct-outline" size={16} color="#FF9500" />
          <Text style={[styles.infoNoteText, { color: "#FF9500" }]}>Serviço em execução</Text>
        </View>
      )}

      {service.status === "completed" && (
        <>
          <View style={[styles.infoNote, { backgroundColor: "rgba(0,230,118,0.1)", borderColor: C.success, borderWidth: 1, borderRadius: 10 }]}>
            <Ionicons name="checkmark-circle-outline" size={17} color={C.success} />
            <Text style={[styles.infoNoteText, { color: C.success, fontFamily: "Inter_600SemiBold" }]}>
              Prestador finalizou o serviço — confirme e avalie!
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: C.success }, pressed && styles.pressed]}
            onPress={onConfirmAndRate}
          >
            <Ionicons name="checkmark-done-outline" size={20} color="#000" />
            <Text style={styles.actionBtnText}>Confirmar Conclusão</Text>
          </Pressable>
        </>
      )}

      {service.status === "rated" && service.clientRating !== undefined && (
        <View style={styles.ratedRow}>
          <Text style={styles.ratedLabel}>Sua avaliação:</Text>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= service.clientRating! ? "star" : "star-outline"}
              size={16}
              color={s <= service.clientRating! ? C.gold : C.textMuted}
            />
          ))}
        </View>
      )}

      {["accepted", "in_progress", "completed", "rated"].includes(service.status) && (
        <Pressable
          style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push(`/chat/${service.id}?role=client` as any)}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={C.primary} />
            <Text style={styles.chatBtnText}>Chat com o Prestador</Text>
          </View>
          {(service.unreadClient ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{service.unreadClient}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward-outline" size={16} color={C.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({
  neighborhood, city, urgent, onNew, onMyServices,
}: {
  neighborhood: string; city: string; urgent: boolean;
  onNew: () => void; onMyServices: () => void;
}) {
  return (
    <View style={styles.successCard}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={60} color={C.success} />
      </View>
      <Text style={styles.successTitle}>Publicado com Sucesso!</Text>
      <Text style={styles.successSub}>
        Sua solicitação está no Mercado Global. Prestadores da sua região já podem ver e aceitar.
      </Text>
      <View style={styles.successBadges}>
        <View style={styles.badge}>
          <Ionicons name="location-outline" size={11} color={C.primary} />
          <Text style={styles.badgeText}>{city}</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="navigate-outline" size={11} color={C.primary} />
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
        style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.7 }]}
        onPress={onNew}
      >
        <Ionicons name="add-outline" size={16} color={C.primary} />
        <Text style={styles.outlineBtnText}>Nova Solicitação</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
        onPress={onMyServices}
      >
        <Text style={styles.ghostBtnText}>Ver Meus Serviços</Text>
        <Ionicons name="arrow-forward-outline" size={14} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}

// ─── Rating modal ──────────────────────────────────────────────────────────────
function RatingModal({
  service, onClose, onConfirm, confirming, done,
}: {
  service: Service;
  onClose: () => void;
  onConfirm: (rating: number) => void;
  confirming: boolean;
  done: boolean;
}) {
  const [rating, setRating] = useState(0);
  const ratingLabels = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente!"];

  if (done) {
    return (
      <View style={styles.modalContent}>
        <View style={styles.successIconSm}>
          <Ionicons name="checkmark-circle" size={72} color={C.success} />
        </View>
        <Text style={styles.modalTitle}>Serviço Concluído!</Text>
        <Text style={styles.modalSub}>Obrigado por usar o SOLICITE. Sua avaliação ajuda a plataforma!</Text>
        <Pressable style={({ pressed }) => [styles.payBtn, pressed && styles.pressed]} onPress={onClose}>
          <Ionicons name="checkmark-done" size={20} color="#000" />
          <Text style={styles.payBtnText}>Fechar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Confirmar Conclusão</Text>
        {!confirming && (
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close-outline" size={20} color={C.textSecondary} />
          </Pressable>
        )}
      </View>

      <Text style={styles.modalSub} numberOfLines={1}>{service.title}</Text>

      <View style={[styles.infoNote, { backgroundColor: "rgba(0,230,118,0.08)", borderColor: C.success, borderWidth: 1, borderRadius: 10, marginBottom: 4 }]}>
        <Ionicons name="checkmark-circle-outline" size={16} color={C.success} />
        <Text style={[styles.infoNoteText, { color: C.success }]}>O prestador marcou este serviço como concluído.</Text>
      </View>

      <View style={styles.ratingSection}>
        <Text style={styles.ratingSectionTitle}>
          Avalie o Prestador{" "}
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted }}>(opcional)</Text>
        </Text>
        <StarRating value={rating} onChange={setRating} size={40} />
        <Text style={[styles.ratingHint, rating > 0 && { color: C.primary }]}>
          {rating === 0 ? "Toque nas estrelas para avaliar (pode pular)" : ratingLabels[rating]}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.payBtn, { backgroundColor: C.success }, pressed && styles.pressed]}
        onPress={() => onConfirm(rating)}
        disabled={confirming}
      >
        {confirming ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <>
            <Ionicons name="checkmark-done-outline" size={20} color="#000" />
            <Text style={styles.payBtnText}>Confirmar Conclusão</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}


// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SolicitacoesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    services, createService, createPayment, confirmPayment, cancelPendingService,
    confirmAndRate, URGENT_FEE, provider,
  } = useApp();

  const API_BASE = process.env.EXPO_PUBLIC_API_URL
    ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  const isPremium = user?.isPremium ?? false;

  const [activeTab, setActiveTab] = useState<"nova" | "meus">("nova");

  // Form state
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [value, setValue]               = useState("");
  const [city, setCity]                 = useState("Goiânia");
  const [neighborhood, setNeighborhood] = useState("");
  const [urgent, setUrgent]             = useState(false);
  const [creating, setCreating]         = useState(false);
  const [formStep, setFormStep]         = useState<"form" | "payment" | "success">("form");

  // Payment step state
  type PixData = { paymentId: string; qrCode: string; pixCode: string; isTestMode: boolean };
  const [pixData, setPixData]                   = useState<PixData | null>(null);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [pixCopied, setPixCopied]               = useState(false);
  const [pixChecking, setPixChecking]           = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rating/confirm modal
  const [ratingService, setRatingService] = useState<Service | null>(null);
  const [confirming, setConfirming]       = useState(false);
  const [confirmDone, setConfirmDone]     = useState(false);

  const numericValue = parseFloat(value.replace(/[^0-9,.]/g, "").replace(",", ".")) || 0;
  const finalValue   = isPremium ? numericValue : (urgent ? numericValue + URGENT_FEE : numericValue);

  const myServices = [...services].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const pendingCount = myServices.filter((s) => s.status === "completed").length;

  // ─── Auto-poll para confirmar pagamento ───────────────────────────────────
  useEffect(() => {
    if (formStep !== "payment" || !pendingServiceId) return;

    const confirmPaid = async () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      await confirmPayment(pendingServiceId);
      setPendingServiceId(null);
      setPixData(null);
      setFormStep("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/payment/status/${pendingServiceId}`);
        if (!res.ok) return;
        const { status } = await res.json();
        if (status === "retained" || status === "paid") {
          await confirmPaid();
        }
      } catch {}
    }, 4000);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [formStep, pendingServiceId]);

  // ─── Create service → payment ──────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !value.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha título, descrição e valor.");
      return;
    }
    if (!city.trim() || !neighborhood.trim()) {
      Alert.alert("Localização obrigatória", "Selecione a cidade e o bairro antes de continuar.");
      return;
    }
    if (numericValue < 5) {
      Alert.alert("Valor mínimo", "O valor mínimo para uma solicitação é R$ 5,00.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);
    try {
      const newService = await createService({
        title: title.trim(), description: description.trim(),
        value: numericValue, city, neighborhood: neighborhood.trim(), urgent,
      });
      const amountInCents = Math.round(finalValue * 100);
      const pix = await createPayment(newService.id, amountInCents, title.trim());
      setPixData(pix);
      setPendingServiceId(newService.id);
      setFormStep("payment");
    } catch (err: any) {
      Alert.alert("Erro ao criar pagamento", err?.message ?? "Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  // ─── Verificar manualmente pagamento ──────────────────────────────────────
  const handleCheckPayment = async () => {
    if (!pendingServiceId || pixChecking) return;
    setPixChecking(true);
    try {
      const res = await fetch(`${API_BASE}/payment/status/${pendingServiceId}`);
      const { status } = await res.json();
      if (status === "retained" || status === "paid") {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        await confirmPayment(pendingServiceId);
        setPendingServiceId(null);
        setPixData(null);
        setFormStep("success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Não confirmado ainda", "O pagamento ainda não foi identificado. Tente novamente em alguns segundos.");
      }
    } catch {
      Alert.alert("Erro de conexão", "Não foi possível verificar o pagamento.");
    } finally {
      setPixChecking(false);
    }
  };

  // ─── Cancelar pagamento pendente ───────────────────────────────────────────
  const handleCancelPayment = () => {
    Alert.alert(
      "Cancelar pagamento",
      "O serviço será removido. Tem certeza?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, cancelar",
          style: "destructive",
          onPress: async () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (pendingServiceId) await cancelPendingService(pendingServiceId);
            setPixData(null); setPendingServiceId(null);
            setFormStep("form");
          },
        },
      ]
    );
  };

  const handleConfirmAndRate = async (rating: number) => {
    if (!ratingService) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirming(true);
    await confirmAndRate(ratingService.id, rating);
    setConfirming(false);
    setConfirmDone(true);
  };

  const handleReset = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setTitle(""); setDescription(""); setValue("");
    setCity("Goiânia"); setNeighborhood("");
    setUrgent(false); setFormStep("form");
    setPixData(null); setPendingServiceId(null);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <SoliciteLogo size="sm" />
            <Text style={styles.headerSub}>Crie e acompanhe seus serviços</Text>
          </View>
          <Pressable
            style={styles.bellBtn}
            onPress={() => setActiveTab("meus")}
            hitSlop={10}
          >
            <Ionicons name="notifications-outline" size={24} color={pendingCount > 0 ? C.primary : C.text} />
            {pendingCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{pendingCount > 9 ? "9+" : pendingCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabSwitcher}>
          {(["nova", "meus"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Ionicons
                  name={tab === "nova" ? "add-circle-outline" : "list-outline"}
                  size={16}
                  color={active ? "#000" : C.textSecondary}
                />
                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                  {tab === "nova" ? "Nova Solicitação" : `Meus Serviços${myServices.length > 0 ? ` (${myServices.length})` : ""}`}
                </Text>
                {tab === "meus" && pendingCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{pendingCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Nova Solicitação ── */}
        {activeTab === "nova" && (
          <>
            <StepBar step={formStep} />

            {formStep === "form" && (
              <View style={styles.card}>
                <InputField label="Título do Serviço" placeholder="Ex: Instalação de ar condicionado" value={title} onChangeText={setTitle} icon="document-text-outline" />
                <InputField label="Descrição" placeholder="Descreva os detalhes do serviço..." value={description} onChangeText={setDescription} icon="reorder-four-outline" multiline numberOfLines={4} />
                <InputField label="Valor (R$)" placeholder="0,00" value={value} onChangeText={setValue} icon="cash-outline" keyboardType="numeric" />

                <LocationPicker
                  city={city}
                  neighborhood={neighborhood}
                  onCityChange={setCity}
                  onNeighborhoodChange={setNeighborhood}
                />

                {isPremium ? (
                  <View style={styles.premiumUrgencyBadge}>
                    <View style={styles.premiumUrgencyIconWrap}>
                      <Ionicons name="flash" size={20} color="#FFD700" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.premiumUrgencyTitle}>Urgência Premium Ativada</Text>
                      <Text style={styles.premiumUrgencySub}>Incluída no seu plano · Sem custo extra</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color="#00E676" />
                  </View>
                ) : (
                  <Pressable
                    style={[styles.urgentToggle, urgent && styles.urgentToggleActive]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUrgent(!urgent); }}
                  >
                    <View style={[styles.urgentIconWrap, urgent && styles.urgentIconWrapActive]}>
                      <Ionicons name="flash" size={20} color={urgent ? "#fff" : C.textTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.urgentTitle}>Serviço Urgente</Text>
                      <Text style={styles.urgentSub}>+R$ 10,00 adicionado ao valor</Text>
                    </View>
                    <View style={[styles.checkbox, urgent && styles.checkboxActive]}>
                      {urgent && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </Pressable>
                )}

                {numericValue > 0 && (
                  <View style={styles.priceSummary}>
                    <View style={styles.orderRow}>
                      <Text style={styles.orderLabel}>Valor base</Text>
                      <Text style={styles.orderValue}>R$ {numericValue.toFixed(2)}</Text>
                    </View>
                    {isPremium ? (
                      <View style={styles.orderRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Ionicons name="flash" size={13} color="#FFD700" />
                          <Text style={[styles.orderLabel, { color: "#FFD700" }]}>Urgência Premium</Text>
                        </View>
                        <Text style={[styles.orderValue, { color: "#00E676" }]}>Grátis</Text>
                      </View>
                    ) : urgent ? (
                      <View style={styles.orderRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Ionicons name="flash" size={13} color={C.danger} />
                          <Text style={[styles.orderLabel, { color: C.danger }]}>Taxa urgência</Text>
                        </View>
                        <Text style={[styles.orderValue, { color: C.danger }]}>+R$ 10,00</Text>
                      </View>
                    ) : null}
                    <View style={[styles.orderRow, styles.orderTotal]}>
                      <Text style={styles.orderTotalLabel}>Total estimado</Text>
                      <Text style={styles.orderTotalValue}>R$ {finalValue.toFixed(2)}</Text>
                    </View>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                      <Text style={styles.primaryBtnText}>Publicar Solicitação</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {formStep === "payment" && pixData && (
              <View style={styles.card}>
                {/* Escrow info */}
                <View style={styles.escrowBadge}>
                  <Ionicons name="lock-closed-outline" size={16} color={C.warning} />
                  <Text style={styles.escrowText}>
                    O valor fica retido pela plataforma e liberado ao prestador após o serviço.
                  </Text>
                </View>

                <Text style={[styles.sectionLabel, { textAlign: "center", marginBottom: 4 }]}>
                  Pague via PIX
                </Text>
                <Text style={[styles.fieldHint, { textAlign: "center", marginBottom: 12 }]}>
                  Valor:{" "}
                  <Text style={{ color: C.text, fontFamily: "Inter_700Bold" }}>
                    R$ {finalValue.toFixed(2)}
                  </Text>
                  {pixData.isTestMode && (
                    <Text style={{ color: C.warning }}> · Modo Teste</Text>
                  )}
                </Text>

                {/* QR Code */}
                {pixData.qrCode ? (
                  <View style={styles.qrWrapper}>
                    <Image
                      source={{ uri: `data:image/png;base64,${pixData.qrCode}` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrHint}>Escaneie o QR Code com o app do seu banco</Text>
                  </View>
                ) : null}

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OU COPIE O CÓDIGO</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Copy code */}
                <Pressable
                  style={styles.copyCodeBtn}
                  onPress={async () => {
                    await Clipboard.setStringAsync(pixData.pixCode);
                    setPixCopied(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeout(() => setPixCopied(false), 3000);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.copyCodeLabel}>Código Pix Copia e Cola</Text>
                    <Text style={styles.copyCodeValue} numberOfLines={2}>
                      {pixData.pixCode.slice(0, 60)}...
                    </Text>
                  </View>
                  <View style={styles.copyIconWrap}>
                    <Ionicons
                      name={pixCopied ? "checkmark" : "copy-outline"}
                      size={18}
                      color={pixCopied ? C.success : C.primary}
                    />
                  </View>
                </Pressable>

                {/* Polling indicator */}
                <View style={styles.pollingBadge}>
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text style={styles.pollingText}>
                    {pixData.isTestMode
                      ? "Modo teste — confirmando automaticamente..."
                      : "Aguardando confirmação do pagamento..."}
                  </Text>
                </View>

                {/* Manual check button */}
                <Pressable
                  style={({ pressed }) => [styles.payBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleCheckPayment}
                  disabled={pixChecking}
                >
                  {pixChecking ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                      <Text style={styles.payBtnText}>Já paguei — Verificar</Text>
                    </>
                  )}
                </Pressable>

                <Text style={styles.payNote}>
                  Após confirmar o pagamento, o serviço será publicado no Mercado Global para os prestadores.
                </Text>

                {/* Cancel */}
                <Pressable onPress={handleCancelPayment} style={styles.ghostBtn}>
                  <Ionicons name="close-circle-outline" size={16} color={C.danger} />
                  <Text style={[styles.ghostBtnText, { color: C.danger }]}>Cancelar solicitação</Text>
                </Pressable>
              </View>
            )}

            {formStep === "success" && (
              <SuccessScreen
                neighborhood={neighborhood}
                city={city}
                urgent={urgent}
                onNew={handleReset}
                onMyServices={() => setActiveTab("meus")}
              />
            )}
          </>
        )}

        {/* ── Meus Serviços ── */}
        {activeTab === "meus" && (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {myServices.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="file-tray-outline" size={40} color={C.textMuted} />
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
                  onConfirmAndRate={() => {
                    setConfirmDone(false);
                    setRatingService(svc);
                  }}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Confirm & Rate modal */}
      <Modal
        visible={ratingService !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!confirming) { setRatingService(null); setConfirmDone(false); }
        }}
      >
        <View style={styles.modalOverlay}>
          {ratingService && (
            <RatingModal
              service={ratingService}
              onClose={() => { setRatingService(null); setConfirmDone(false); }}
              onConfirm={handleConfirmAndRate}
              confirming={confirming}
              done={confirmDone}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center" },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: C.background,
  },
  bellBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },

  tabSwitcher: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: C.border, gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: 9,
  },
  tabBtnActive: { backgroundColor: C.primary },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  tabBtnTextActive: { color: "#000" },
  tabBadge: {
    backgroundColor: C.danger, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2, minWidth: 18, alignItems: "center",
  },
  tabBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },

  stepBar: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 14,
  },
  stepItem: { alignItems: "center", gap: 5 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.backgroundTertiary, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  stepDotDone: { backgroundColor: C.primary, borderColor: C.primary },
  stepDotCurrent: { backgroundColor: C.primary, borderColor: C.primary },
  stepNum: { fontSize: 12, fontFamily: "Inter_700Bold", color: C.textMuted },
  stepLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textMuted },
  stepLine: { flex: 1, height: 2, backgroundColor: C.border, marginHorizontal: 6, marginBottom: 14 },
  stepLineDone: { backgroundColor: C.primary },

  card: {
    marginHorizontal: 16, backgroundColor: C.surface,
    borderRadius: 20, padding: 20, gap: 16,
    borderWidth: 1, borderColor: C.border,
  },

  sectionLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  fieldHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },

  inputWrapper: { gap: 7 },
  inputHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  input: {
    backgroundColor: C.backgroundTertiary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
    borderWidth: 1, borderColor: C.border,
  },
  inputMultiline: { height: 96, paddingTop: 14 },
  inputFocused: { borderColor: C.primary },

  urgentToggle: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.backgroundTertiary, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  urgentToggleActive: { borderColor: C.danger, backgroundColor: "rgba(255,59,92,0.08)" },
  urgentIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: C.border, alignItems: "center", justifyContent: "center",
  },
  urgentIconWrapActive: { backgroundColor: C.danger },
  urgentTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  urgentSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 },
  premiumUrgencyBadge: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,215,0,0.07)", borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: "rgba(255,215,0,0.35)",
  },
  premiumUrgencyIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "rgba(255,215,0,0.18)", alignItems: "center", justifyContent: "center",
  },
  premiumUrgencyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFD700" },
  premiumUrgencySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#00E676", marginTop: 2 },
  checkbox: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },

  priceSummary: {
    backgroundColor: C.backgroundTertiary, borderRadius: 12,
    padding: 14, gap: 10, borderWidth: 1, borderColor: C.border,
  },
  orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
  orderValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  orderTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 2 },
  orderTotalLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  orderTotalValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.primary },
  orderSummary: {
    backgroundColor: C.backgroundTertiary, borderRadius: 14,
    padding: 16, gap: 12, borderWidth: 1, borderColor: C.border,
  },
  orderSummaryTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 4 },

  primaryBtn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 17,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  escrowNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: C.primaryGlow, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.primary,
  },
  escrowNoticeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary, marginBottom: 4 },
  escrowNoticeDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 18 },

  // Pix info banner
  pixInfo: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(0,230,118,0.07)", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "rgba(0,230,118,0.25)",
  },
  pixInfoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 18 },

  // Polling badge
  pollingBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.primaryGlow, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: C.primary + "50",
  },
  pollingText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.primary, flex: 1 },

  // QR code
  qrWrapper: { alignItems: "center", gap: 10 },
  qrImage: { width: 220, height: 220, borderRadius: 12 },
  qrHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },

  // Divider
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted },

  // Copy code button
  copyCodeBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.backgroundTertiary, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  copyCodeLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  copyCodeValue: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  copyIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.primaryGlow, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.primary + "40",
  },

  payBtn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  payBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
  payNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center", lineHeight: 18 },

  escrowBadge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "rgba(255,184,0,0.12)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,184,0,0.3)",
  },
  escrowText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.warning, flex: 1 },

  successCard: {
    marginHorizontal: 16, backgroundColor: C.surface,
    borderRadius: 20, padding: 28, alignItems: "center",
    borderWidth: 1, borderColor: C.border, gap: 16,
  },
  successIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.successLight, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.success,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 21 },
  successBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.primaryGlow, borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 5,
    borderWidth: 1, borderColor: C.primary,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.primary },
  outlineBtn: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.primary,
  },
  outlineBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.primary },
  ghostBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  ghostBtnText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },

  serviceCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, gap: 12,
  },
  serviceCardUrgent: { borderColor: C.danger },
  serviceCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  serviceCardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textTertiary },
  serviceCardValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.primary },
  urgentTag: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: C.dangerLight, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  urgentTagText: { fontSize: 9, fontFamily: "Inter_700Bold", color: C.danger, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  infoNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: C.backgroundTertiary, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border,
  },
  infoNoteText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, flex: 1 },
  actionBtn: {
    borderRadius: 14, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },
  ratedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratedLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, marginRight: 4 },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 14 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 21, paddingHorizontal: 24 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 24, paddingBottom: 36, gap: 20,
    borderTopWidth: 1, borderColor: C.border,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  modalSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center",
  },
  breakdownBox: {
    backgroundColor: C.backgroundTertiary, borderRadius: 14,
    padding: 16, gap: 12, borderWidth: 1, borderColor: C.border,
  },
  breakdownTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  ratingSection: { alignItems: "center", gap: 12 },
  ratingSectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  ratingHint: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  successIconSm: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.successLight, alignItems: "center", justifyContent: "center",
    alignSelf: "center", borderWidth: 2, borderColor: C.success,
  },
  releaseBox: {
    backgroundColor: C.successLight, borderRadius: 14,
    padding: 20, alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: C.success, width: "100%",
  },
  releaseLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
  releaseValue: { fontSize: 32, fontFamily: "Inter_700Bold", color: C.success },
  releaseFee: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted },

  chatBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.primaryGlow, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.primary + "60",
    gap: 4,
  },
  chatBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary },
  unreadBadge: {
    backgroundColor: C.danger, borderRadius: 10,
    minWidth: 20, height: 20,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
});
