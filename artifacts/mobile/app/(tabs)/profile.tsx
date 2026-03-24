import { Ionicons } from "@expo/vector-icons";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { ProviderPlan } from "@/context/AppContext";
import { SoliciteLogo } from "@/components/SoliciteLogo";
import { useAuth } from "@/context/AuthContext";

const C = Colors.dark;

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star;
        const half = !filled && rating >= star - 0.5;
        return (
          <Ionicons
            key={star}
            name={filled ? "star" : half ? "star-half" : "star-outline"}
            size={size}
            color={filled || half ? C.gold : C.textMuted}
          />
        );
      })}
    </View>
  );
}

const PROMO_ENDS = "31/03/2026";

type PlanConfig = {
  key: ProviderPlan;
  name: string;
  price: number;
  promoPrice?: number;
  color: string;
  bgColor: string;
  borderColor: string;
  benefits: string[];
  badge?: string;
  promoBadge?: string;
};

const plans: PlanConfig[] = [
  {
    key: "basic",
    name: "Plano Básico",
    price: 80,
    promoPrice: 59,
    color: C.primary,
    bgColor: C.primaryGlow,
    borderColor: C.primary,
    promoBadge: "PROMOÇÃO",
    benefits: [
      "Sem taxa de 10% da plataforma",
      "Serviços ilimitados no Global",
      "Suporte prioritário",
      "Perfil verificado ✓",
    ],
  },
  {
    key: "destaque",
    name: "Plano Destaque",
    price: 99,
    promoPrice: 79,
    color: C.accent,
    bgColor: C.accentLight,
    borderColor: C.accent,
    badge: "MAIS POPULAR",
    promoBadge: "PROMOÇÃO",
    benefits: [
      "Sem taxa de 10% da plataforma",
      "Perfil em destaque no Global",
      "Badge 'Destaque' visível aos clientes",
      "Prioridade de exibição nas buscas",
      "Relatórios mensais de desempenho",
    ],
  },
  {
    key: "premium",
    name: "Plano Premium",
    price: 120,
    promoPrice: 99,
    color: C.gold,
    bgColor: "rgba(255, 215, 0, 0.12)",
    borderColor: C.gold,
    badge: "MÁXIMAS VANTAGENS",
    promoBadge: "PROMOÇÃO",
    benefits: [
      "Sem taxa de 10% da plataforma",
      "Perfil premium destacado no topo",
      "Badge premium exclusivo no perfil",
      "Máxima prioridade de exibição",
      "Relatórios avançados em tempo real",
      "Suporte VIP 24/7",
    ],
  },
];

type WithdrawMethod = "pix" | "bank";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { provider, subscribePlan, pendingEarnings, withdrawEarnings } = useApp();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          logout();
        },
      },
    ]);
  };
  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>("pix");
  const [pixKey, setPixKey] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const handleSubscribe = async (plan: PlanConfig) => {
    Alert.alert(
      `Assinar ${plan.name}`,
      `R$ ${plan.price},00/mês\n\nDeseja continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Assinar",
          style: "default",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSubscribing(true);
            await new Promise((r) => setTimeout(r, 1000));
            await subscribePlan(plan.key);
            setSubscribing(false);
            setSelectedPlan(null);
          },
        },
      ]
    );
  };

  const currentPlan = plans.find((p) => p.key === provider.plan);

  const planLabel =
    provider.plan === "free"
      ? "Gratuito"
      : provider.plan === "basic"
      ? "Básico"
      : provider.plan === "destaque"
      ? "Destaque"
      : "Premium";

  const planExpiry = provider.planExpiresAt
    ? new Date(provider.planExpiresAt).toLocaleDateString("pt-BR")
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── App header bar ── */}
      <View style={styles.topBar}>
        <SoliciteLogo size="sm" />
        <View style={{ flex: 1 }} />
        {user && (
          <View style={styles.userBadge}>
            <Ionicons name="person-circle-outline" size={16} color={C.primary} />
            <Text style={styles.userBadgeText} numberOfLines={1}>
              {user.name.split(" ")[0]}
            </Text>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.75 }]}
          onPress={handleLogout}
          hitSlop={10}
        >
          <Ionicons name="log-out-outline" size={20} color={C.danger} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {provider.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            {provider.plan === "premium" && (
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond" size={12} color={C.gold} />
              </View>
            )}
          </View>

          <Text style={styles.profileName}>{provider.name}</Text>

          <View style={styles.ratingRow}>
            <StarDisplay rating={provider.rating} size={20} />
            <Text style={styles.ratingNumber}>{provider.rating}</Text>
            <Text style={styles.ratingCount}>
              ({provider.totalRatings} avaliações)
            </Text>
          </View>

          <View style={styles.planBadge}>
            {provider.plan === "premium" && (
              <Ionicons name="diamond" size={13} color={C.gold} />
            )}
            {provider.plan === "destaque" && (
              <Ionicons name="star" size={13} color={C.accent} />
            )}
            {provider.plan === "basic" && (
              <Ionicons name="star" size={13} color={C.primary} />
            )}
            {provider.plan === "free" && (
              <Ionicons name="person-outline" size={13} color={C.textSecondary} />
            )}
            <Text
              style={[
                styles.planBadgeText,
                provider.plan === "premium" && { color: C.gold },
                provider.plan === "destaque" && { color: C.accent },
                provider.plan === "basic" && { color: C.primary },
              ]}
            >
              {planLabel}
            </Text>
            {planExpiry && (
              <Text style={styles.planExpiry}>até {planExpiry}</Text>
            )}
          </View>

          {(provider.plan === "premium" || provider.plan === "destaque") && (
            <View style={[
              styles.premiumHighlight,
              provider.plan === "destaque" && { borderColor: C.accent, backgroundColor: C.accentLight },
            ]}>
              <Ionicons
                name={provider.plan === "premium" ? "diamond-outline" : "star-outline"}
                size={16}
                color={provider.plan === "premium" ? C.gold : C.accent}
              />
              <Text style={[
                styles.premiumHighlightText,
                provider.plan === "destaque" && { color: C.accent },
              ]}>
                {provider.plan === "premium" ? "Prestador Premium em Destaque" : "Prestador em Destaque"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsGridCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={24}
              color={C.primary}
            />
            <Text style={styles.statsGridValue}>{provider.completedJobs}</Text>
            <Text style={styles.statsGridLabel}>Trabalhos concluídos</Text>
          </View>
          <View style={styles.statsGridCard}>
            <Ionicons name="star" size={24} color={C.gold} />
            <Text style={[styles.statsGridValue, { color: C.gold }]}>
              {provider.rating} ⭐
            </Text>
            <Text style={styles.statsGridLabel}>Avaliação média</Text>
          </View>
        </View>

        {/* ── CARTEIRA ── */}
        <View style={styles.walletCard}>
          {/* Saldo Pendente (em custódia) */}
          {pendingEarnings > 0 && (
            <View style={styles.pendingRow}>
              <View style={styles.pendingIconWrap}>
                <Ionicons name="lock-closed" size={20} color={C.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingLabel}>Saldo Pendente (em custódia)</Text>
                <Text style={styles.pendingValue}>
                  R$ {pendingEarnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          )}
          {pendingEarnings > 0 && <View style={styles.walletDivider} />}

          {/* Saldo Disponível (para saque) */}
          <View style={styles.walletHeader}>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet" size={24} color={C.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletLabel}>Saldo Disponível</Text>
              <Text style={styles.walletBalance}>
                R$ {provider.earnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.withdrawBtn,
                provider.earnings <= 0 && styles.withdrawBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setWithdrawSuccess(false);
                setWithdrawModal(true);
              }}
              disabled={provider.earnings <= 0}
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color={provider.earnings <= 0 ? C.textMuted : "#000"} />
              <Text style={[styles.withdrawBtnText, provider.earnings <= 0 && { color: C.textMuted }]}>Sacar</Text>
            </Pressable>
          </View>

          {/* Custódia info */}
          {pendingEarnings > 0 ? (
            <View style={[styles.walletInfoRow, { backgroundColor: "rgba(255,184,0,0.08)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(255,184,0,0.2)" }]}>
              <Ionicons name="lock-closed-outline" size={14} color={C.warning} />
              <Text style={[styles.walletInfoText, { color: C.warning }]}>
                R$ {pendingEarnings.toFixed(2)} retido na plataforma. Será liberado após o cliente confirmar o serviço.
              </Text>
            </View>
          ) : (
            <View style={styles.walletInfoRow}>
              <Ionicons name="information-circle-outline" size={14} color={C.textTertiary} />
              <Text style={styles.walletInfoText}>
                Saque via PIX em até 1 dia útil · Mínimo R$ 10,00
              </Text>
            </View>
          )}

          {/* Histórico de saques */}
          {(provider.withdrawn ?? 0) > 0 && (
            <View style={styles.walletInfoRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.success} />
              <Text style={[styles.walletInfoText, { color: C.success }]}>
                Total sacado: R$ {(provider.withdrawn ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planos de Assinatura</Text>
          <Text style={styles.sectionSubtitle}>
            Assine e tenha mais vantagens na plataforma
          </Text>
        </View>

        {/* Promotion banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoBannerLeft}>
            <Ionicons name="flash" size={18} color={C.warning} />
            <View>
              <Text style={styles.promoBannerTitle}>Promoção por tempo limitado!</Text>
              <Text style={styles.promoBannerSub}>Preços especiais até {PROMO_ENDS}</Text>
            </View>
          </View>
          <View style={styles.promoBannerTag}>
            <Text style={styles.promoBannerTagText}>ATÉ 25% OFF</Text>
          </View>
        </View>

        {plans.map((plan) => {
          const isActive = provider.plan === plan.key;
          const displayPrice = plan.promoPrice ?? plan.price;
          return (
            <Pressable
              key={plan.key}
              style={({ pressed }) => [
                styles.planCard,
                isActive && { borderColor: plan.borderColor },
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => !isActive && setSelectedPlan(plan)}
            >
              {/* Badges row */}
              <View style={styles.planBadgesRow}>
                {plan.badge && (
                  <View style={[styles.planCardBadge, { backgroundColor: plan.bgColor, borderColor: plan.borderColor }]}>
                    <Text style={[styles.planCardBadgeText, { color: plan.color }]}>
                      {plan.badge}
                    </Text>
                  </View>
                )}
                {plan.promoBadge && (
                  <View style={styles.planPromoBadge}>
                    <Ionicons name="flash" size={10} color={C.warning} />
                    <Text style={styles.planPromoBadgeText}>{plan.promoBadge}</Text>
                  </View>
                )}
              </View>

              <View style={styles.planCardHeader}>
                <View style={{ gap: 2 }}>
                  <Text style={styles.planCardName}>{plan.name}</Text>
                  <View style={styles.planCardPriceRow}>
                    {plan.promoPrice && (
                      <Text style={styles.planOriginalPrice}>R$ {plan.price}</Text>
                    )}
                    <Text style={[styles.planCardPrice, { color: plan.color }]}>
                      R$ {displayPrice}
                    </Text>
                    <Text style={styles.planCardPeriod}>/mês</Text>
                  </View>
                </View>
                {isActive ? (
                  <View style={[styles.activeTag, { backgroundColor: plan.bgColor, borderColor: plan.borderColor }]}>
                    <Ionicons name="checkmark-circle" size={14} color={plan.color} />
                    <Text style={[styles.activeTagText, { color: plan.color }]}>Ativo</Text>
                  </View>
                ) : (
                  <View style={[styles.subscribeTag, { backgroundColor: plan.bgColor, borderColor: plan.borderColor }]}>
                    <Text style={[styles.subscribeTagText, { color: plan.color }]}>
                      Assinar
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.planCardBenefits}>
                {plan.benefits.map((benefit, i) => (
                  <View key={i} style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={plan.color} />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}

        {provider.plan !== "free" && (
          <View style={styles.feeInfo}>
            <Ionicons name="information-circle-outline" size={16} color={C.success} />
            <Text style={styles.feeInfoText}>
              Com seu plano ativo, você não paga a taxa de 10% da plataforma
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── MODAL DE SAQUE ── */}
      <Modal
        visible={withdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!withdrawing) setWithdrawModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {withdrawSuccess ? (
              <View style={{ alignItems: "center", gap: 16 }}>
                <View style={[styles.withdrawSuccessIcon, { backgroundColor: C.successLight, borderColor: C.success }]}>
                  <Ionicons name="checkmark-circle" size={64} color={C.success} />
                </View>
                <Text style={[styles.modalTitle, { textAlign: "center" }]}>Saque Solicitado!</Text>
                <Text style={[styles.planModalSubtitle, { textAlign: "center" }]}>
                  O valor será creditado em até 1 dia útil na sua chave PIX.
                </Text>
                <View style={styles.withdrawSuccessBox}>
                  <Text style={styles.withdrawSuccessLabel}>Valor solicitado</Text>
                  <Text style={styles.withdrawSuccessValue}>
                    R$ {parseFloat(withdrawAmount.replace(",", ".") || "0").toFixed(2)}
                  </Text>
                  <Text style={styles.withdrawSuccessKey}>→ PIX: {pixKey}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.subscribeCta, { backgroundColor: C.primary }, pressed && { opacity: 0.85 }]}
                  onPress={() => setWithdrawModal(false)}
                >
                  <Text style={[styles.subscribeCtaText, { color: "#000" }]}>Fechar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Solicitar Saque</Text>
                  <Pressable onPress={() => setWithdrawModal(false)} style={styles.modalClose} hitSlop={12}>
                    <Ionicons name="close-outline" size={20} color={C.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.walletBalanceMini}>
                  <Text style={styles.walletBalanceMiniLabel}>Saldo disponível</Text>
                  <Text style={styles.walletBalanceMiniValue}>
                    R$ {provider.earnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Method */}
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>Forma de Saque</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {([
                      { id: "pix" as const, label: "PIX", icon: "flash" as const },
                      { id: "bank" as const, label: "Conta Bancária", icon: "business-outline" as const },
                    ]).map((m) => (
                      <Pressable
                        key={m.id}
                        style={[styles.methodCard, withdrawMethod === m.id && styles.methodCardActive]}
                        onPress={() => setWithdrawMethod(m.id)}
                      >
                        <Ionicons name={m.icon} size={20} color={withdrawMethod === m.id ? C.primary : C.textSecondary} />
                        <Text style={[styles.methodCardLabel, withdrawMethod === m.id && { color: C.primary }]}>{m.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Key */}
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>
                    {withdrawMethod === "pix" ? "Chave PIX (CPF, e-mail ou telefone)" : "Dados Bancários"}
                  </Text>
                  <TextInput
                    style={styles.withdrawInput}
                    placeholder={withdrawMethod === "pix" ? "Ex: 000.000.000-00" : "Banco • Agência • Conta"}
                    placeholderTextColor={C.textMuted}
                    value={pixKey}
                    onChangeText={setPixKey}
                    autoCapitalize="none"
                    keyboardType={withdrawMethod === "pix" ? "email-address" : "default"}
                  />
                </View>

                {/* Amount */}
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>Valor a Sacar (R$)</Text>
                  <TextInput
                    style={styles.withdrawInput}
                    placeholder="0,00"
                    placeholderTextColor={C.textMuted}
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    keyboardType="numeric"
                  />
                  <Text style={styles.withdrawHint}>Mínimo R$ 10,00 · Máximo R$ {provider.earnings.toFixed(2)}</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.subscribeCta,
                    { backgroundColor: C.success },
                    (!pixKey.trim() || !withdrawAmount.trim()) && { opacity: 0.4 },
                    pressed && { opacity: 0.85 },
                  ]}
                  disabled={!pixKey.trim() || !withdrawAmount.trim() || withdrawing}
                  onPress={async () => {
                    const amt = parseFloat(withdrawAmount.replace(",", "."));
                    if (isNaN(amt) || amt < 10) {
                      Alert.alert("Valor inválido", "O valor mínimo para saque é R$ 10,00.");
                      return;
                    }
                    if (amt > provider.earnings) {
                      Alert.alert("Saldo insuficiente", "O valor solicitado é maior que seu saldo.");
                      return;
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setWithdrawing(true);
                    await new Promise((r) => setTimeout(r, 2000));
                    const ok = await withdrawEarnings(amt);
                    setWithdrawing(false);
                    if (!ok) {
                      Alert.alert("Erro", "Saldo insuficiente para saque.");
                      return;
                    }
                    setWithdrawSuccess(true);
                  }}
                >
                  {withdrawing ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Ionicons name="arrow-up-circle-outline" size={20} color="#000" />
                      <Text style={[styles.subscribeCtaText, { color: "#000" }]}>Solicitar Saque</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedPlan !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPlan(null)}
      >
        {selectedPlan && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Pressable
                style={styles.modalClose}
                onPress={() => setSelectedPlan(null)}
              >
                <Ionicons name="close-outline" size={20} color={C.textSecondary} />
              </Pressable>

              <Text style={styles.modalTitle}>{selectedPlan.name}</Text>
              <Text style={[styles.modalPrice, { color: selectedPlan.color }]}>
                R$ {selectedPlan.price},00/mês
              </Text>

              <View style={styles.modalBenefits}>
                {selectedPlan.benefits.map((benefit, i) => (
                  <View key={i} style={styles.modalBenefitRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={selectedPlan.color}
                    />
                    <Text style={styles.modalBenefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.modalSubscribeButton,
                  { backgroundColor: selectedPlan.color },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => handleSubscribe(selectedPlan)}
                disabled={subscribing}
              >
                <Text style={styles.modalSubscribeText}>
                  {subscribing ? "Processando..." : `Assinar por R$ ${selectedPlan.price},00/mês`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,212,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.2)",
    maxWidth: 120,
  },
  userBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,59,92,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,59,92,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    margin: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.primaryGlow,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: C.primary,
  },
  premiumBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    borderWidth: 2,
    borderColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingNumber: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  ratingCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  planBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  planExpiry: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  premiumHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    width: "100%",
    justifyContent: "center",
  },
  premiumHighlightText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.gold,
  },
  statsGrid: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  statsGridCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  statsGridValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  statsGridLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  planCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
    overflow: "hidden",
  },
  // Promotion banner
  promoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.warningLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.warning,
    gap: 12,
    marginHorizontal: 16,
  },
  promoBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  promoBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.warning },
  promoBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.warning, opacity: 0.8 },
  promoBannerTag: {
    backgroundColor: C.warning,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  promoBannerTagText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#000" },

  // Plan badges row
  planBadgesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  planCardBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  planCardBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  planPromoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.warningLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.warning,
  },
  planPromoBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: C.warning, letterSpacing: 1 },
  planOriginalPrice: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textDecorationLine: "line-through",
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planCardName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 4,
  },
  planCardPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  planCardPrice: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  planCardPeriod: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  activeTagText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  subscribeTag: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  subscribeTagText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  planCardBenefits: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    flex: 1,
  },
  feeInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: C.successLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.success,
  },
  feeInfoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.success,
    flex: 1,
    lineHeight: 20,
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
    padding: 28,
    gap: 18,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  modalClose: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  modalPrice: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  modalBenefits: {
    gap: 12,
  },
  modalBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalBenefitText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    flex: 1,
  },
  modalSubscribeButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  modalSubscribeText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  planModalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 22,
  },
  subscribeCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
  },
  subscribeCtaText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  // WALLET
  walletCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: C.backgroundSecondary,
    borderWidth: 1,
    borderColor: C.success + "60",
    padding: 18,
    gap: 14,
  },
  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.successLight,
    borderWidth: 1,
    borderColor: C.success,
    alignItems: "center",
    justifyContent: "center",
  },
  walletLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginBottom: 2,
  },
  walletBalance: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  withdrawBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  withdrawBtnDisabled: {
    backgroundColor: C.backgroundTertiary,
    borderWidth: 1,
    borderColor: C.border,
  },
  walletDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 2,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,184,0,0.07)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.25)",
  },
  pendingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,184,0,0.15)",
    borderWidth: 1,
    borderColor: C.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.warning,
    marginBottom: 3,
    opacity: 0.85,
  },
  pendingValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.warning,
  },
  walletInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  walletInfoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    flex: 1,
  },
  // WITHDRAW MODAL
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  walletBalanceMini: {
    backgroundColor: C.successLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.success + "50",
    alignItems: "center",
    gap: 4,
  },
  walletBalanceMiniLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.success,
  },
  walletBalanceMiniValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  methodCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.backgroundTertiary,
    borderWidth: 1,
    borderColor: C.border,
  },
  methodCardActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryGlow,
  },
  methodCardLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    flex: 1,
  },
  withdrawInput: {
    backgroundColor: C.backgroundTertiary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  withdrawHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textAlign: "center",
  },
  withdrawSuccessIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawSuccessBox: {
    backgroundColor: C.successLight,
    borderWidth: 1,
    borderColor: C.success,
    borderRadius: 14,
    padding: 16,
    width: "100%",
    gap: 4,
    alignItems: "center",
  },
  withdrawSuccessLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.success,
  },
  withdrawSuccessValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  withdrawSuccessKey: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
});
