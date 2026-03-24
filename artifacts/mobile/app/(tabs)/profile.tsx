import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { ProviderPlan } from "@/context/AppContext";

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

type PlanConfig = {
  key: ProviderPlan;
  name: string;
  price: number;
  color: string;
  bgColor: string;
  borderColor: string;
  benefits: string[];
  badge?: string;
};

const plans: PlanConfig[] = [
  {
    key: "basic",
    name: "Plano Básico",
    price: 80,
    color: C.primary,
    bgColor: C.primaryGlow,
    borderColor: C.primary,
    benefits: [
      "Sem taxa de 10% da plataforma",
      "Serviços ilimitados",
      "Suporte prioritário",
      "Perfil verificado",
    ],
  },
  {
    key: "premium",
    name: "Plano Premium",
    price: 120,
    color: C.gold,
    bgColor: "rgba(255, 215, 0, 0.12)",
    borderColor: C.gold,
    badge: "MAIS VANTAGENS",
    benefits: [
      "Sem taxa de 10% da plataforma",
      "Perfil em destaque no Global",
      "Badge premium no perfil",
      "Prioridade de exibição",
      "Relatórios de desempenho",
      "Suporte 24/7",
    ],
  },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { provider, subscribePlan } = useApp();
  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null);
  const [subscribing, setSubscribing] = useState(false);

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
      : "Premium";

  const planExpiry = provider.planExpiresAt
    ? new Date(provider.planExpiresAt).toLocaleDateString("pt-BR")
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
            {provider.plan === "basic" && (
              <Ionicons name="star" size={13} color={C.primary} />
            )}
            {provider.plan === "free" && (
              <Feather name="user" size={13} color={C.textSecondary} />
            )}
            <Text
              style={[
                styles.planBadgeText,
                provider.plan === "premium" && { color: C.gold },
                provider.plan === "basic" && { color: C.primary },
              ]}
            >
              {planLabel}
            </Text>
            {planExpiry && (
              <Text style={styles.planExpiry}>até {planExpiry}</Text>
            )}
          </View>

          {provider.plan === "premium" && (
            <View style={styles.premiumHighlight}>
              <Ionicons name="diamond-outline" size={16} color={C.gold} />
              <Text style={styles.premiumHighlightText}>
                Prestador Premium em Destaque
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsGridCard}>
            <MaterialCommunityIcons
              name="briefcase-check"
              size={24}
              color={C.primary}
            />
            <Text style={styles.statsGridValue}>{provider.completedJobs}</Text>
            <Text style={styles.statsGridLabel}>Trabalhos concluídos</Text>
          </View>
          <View style={styles.statsGridCard}>
            <Ionicons name="wallet-outline" size={24} color={C.success} />
            <Text style={[styles.statsGridValue, { color: C.success }]}>
              R$ {provider.earnings.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </Text>
            <Text style={styles.statsGridLabel}>Total ganho</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planos de Assinatura</Text>
          <Text style={styles.sectionSubtitle}>
            Assine e tenha mais vantagens na plataforma
          </Text>
        </View>

        {plans.map((plan) => {
          const isActive = provider.plan === plan.key;
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
              {plan.badge && (
                <View style={[styles.planCardBadge, { backgroundColor: plan.bgColor, borderColor: plan.borderColor }]}>
                  <Text style={[styles.planCardBadgeText, { color: plan.color }]}>
                    {plan.badge}
                  </Text>
                </View>
              )}

              <View style={styles.planCardHeader}>
                <View>
                  <Text style={styles.planCardName}>{plan.name}</Text>
                  <View style={styles.planCardPriceRow}>
                    <Text style={[styles.planCardPrice, { color: plan.color }]}>
                      R$ {plan.price}
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
                <Feather name="x" size={20} color={C.textSecondary} />
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
});
