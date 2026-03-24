import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

const C = Colors.dark;

function StarRating({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange?.(star)}>
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

export default function ProviderScreen() {
  const insets = useSafeAreaInsets();
  const { activeService, provider, finalizeService, confirmClientPayment, rateService, PLATFORM_FEE_RATE } = useApp();
  const [finalizing, setFinalizing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    fee: number;
    providerEarning: number;
  } | null>(null);
  const [rating, setRating] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const handleFinalize = async () => {
    if (!activeService) return;
    Alert.alert(
      "Finalizar Serviço",
      "Tem certeza que deseja marcar este serviço como concluído?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          style: "default",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setFinalizing(true);
            await finalizeService(activeService.id);
            setFinalizing(false);
          },
        },
      ]
    );
  };

  const handleConfirmPayment = async () => {
    if (!activeService) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result = await confirmClientPayment(activeService.id);
    if (result) {
      setPaymentResult(result);
      setShowRatingModal(true);
    }
  };

  const handleSubmitRating = async () => {
    if (!activeService || rating === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await rateService(activeService.id, rating, "provider");
    setShowRatingModal(false);
    setRatingSubmitted(true);
  };

  const isCompleted = activeService?.status === "completed";
  const isRated = activeService?.status === "rated";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Área do Prestador</Text>
          <Text style={styles.headerSubtitle}>
            {activeService
              ? "Serviço em andamento"
              : "Nenhum serviço ativo no momento"}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{provider.completedJobs}</Text>
            <Text style={styles.statLabel}>Trabalhos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              R$ {provider.earnings.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </Text>
            <Text style={styles.statLabel}>Ganhos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{provider.rating}</Text>
            <Text style={styles.statLabel}>Avaliação</Text>
          </View>
        </View>

        {!activeService ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name="briefcase-clock-outline"
                size={44}
                color={C.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>Sem serviço ativo</Text>
            <Text style={styles.emptySubtitle}>
              Vá para o Mercado Global para aceitar um serviço disponível
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.goGlobalButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push("/(tabs)/global")}
            >
              <Feather name="globe" size={16} color={C.primary} />
              <Text style={styles.goGlobalButtonText}>Ver Mercado Global</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.activeCard}>
            <View style={styles.activeCardHeader}>
              <View style={[styles.statusDot, isCompleted && styles.statusDotCompleted, isRated && styles.statusDotRated]} />
              <Text style={styles.statusLabel}>
                {isRated
                  ? "Finalizado"
                  : isCompleted
                  ? "Aguardando confirmação"
                  : "Em andamento"}
              </Text>
            </View>

            <Text style={styles.activeTitle}>{activeService.title}</Text>
            <Text style={styles.activeDescription}>
              {activeService.description}
            </Text>

            <View style={styles.activeMetaGrid}>
              <View style={styles.activeMeta}>
                <Feather name="map-pin" size={14} color={C.primary} />
                <Text style={styles.activeMetaText}>{activeService.city}</Text>
              </View>
              <View style={styles.activeMeta}>
                <Feather name="navigation" size={14} color={C.primary} />
                <Text style={styles.activeMetaText}>{activeService.neighborhood}</Text>
              </View>
              <View style={styles.activeMeta}>
                <Ionicons
                  name={activeService.urgent ? "flash" : "time-outline"}
                  size={14}
                  color={activeService.urgent ? C.danger : C.primary}
                />
                <Text style={[styles.activeMetaText, activeService.urgent && { color: C.danger }]}>
                  {activeService.urgent ? "Urgente" : "Normal"}
                </Text>
              </View>
            </View>

            <View style={styles.valueBox}>
              <View style={styles.valueBoxRow}>
                <Text style={styles.valueBoxLabel}>Valor do serviço</Text>
                <Text style={styles.valueBoxAmount}>
                  R$ {activeService.finalValue.toFixed(2)}
                </Text>
              </View>
              <View style={styles.valueBoxRow}>
                <Text style={styles.valueBoxLabel}>Taxa da plataforma ({(PLATFORM_FEE_RATE * 100).toFixed(0)}%)</Text>
                <Text style={[styles.valueBoxAmount, { color: C.danger }]}>
                  -R$ {(activeService.finalValue * PLATFORM_FEE_RATE).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.valueBoxRow, styles.valueBoxTotal]}>
                <Text style={styles.valueBoxTotalLabel}>Você recebe</Text>
                <Text style={styles.valueBoxTotalAmount}>
                  R$ {(activeService.finalValue * (1 - PLATFORM_FEE_RATE)).toFixed(2)}
                </Text>
              </View>
            </View>

            {!isCompleted && !isRated && (
              <Pressable
                style={({ pressed }) => [
                  styles.chatButton,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.push(`/chat/${activeService.id}`)}
              >
                <Feather name="message-circle" size={18} color={C.primary} />
                <Text style={styles.chatButtonText}>Chat com o Cliente</Text>
              </Pressable>
            )}

            {!isCompleted && !isRated && (
              <Pressable
                style={({ pressed }) => [
                  styles.finalizeButton,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleFinalize}
                disabled={finalizing}
              >
                {finalizing ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#000" />
                    <Text style={styles.finalizeButtonText}>Finalizar Serviço</Text>
                  </>
                )}
              </Pressable>
            )}

            {isCompleted && !isRated && (
              <View style={styles.completedActions}>
                <View style={styles.completedBanner}>
                  <Ionicons name="time-outline" size={16} color={C.warning} />
                  <Text style={styles.completedBannerText}>
                    Aguardando confirmação do cliente
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmPaymentButton,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={handleConfirmPayment}
                >
                  <Ionicons name="checkmark-done" size={20} color="#000" />
                  <Text style={styles.confirmPaymentText}>
                    Confirmar Pagamento do Cliente
                  </Text>
                </Pressable>
              </View>
            )}

            {isRated && (
              <View style={styles.completedFinalBox}>
                <View style={styles.completedFinalIcon}>
                  <Ionicons name="checkmark-circle" size={36} color={C.success} />
                </View>
                <Text style={styles.completedFinalTitle}>Serviço Concluído!</Text>
                {paymentResult && (
                  <Text style={styles.completedFinalValue}>
                    Você recebeu R$ {paymentResult.providerEarning.toFixed(2)}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Avalie o Cliente</Text>
            <Text style={styles.modalSubtitle}>
              Como foi a experiência com este cliente?
            </Text>

            <StarRating value={rating} onChange={setRating} size={36} />

            {paymentResult && (
              <View style={styles.modalPaymentBox}>
                <Text style={styles.modalPaymentLabel}>Você recebeu:</Text>
                <Text style={styles.modalPaymentValue}>
                  R$ {paymentResult.providerEarning.toFixed(2)}
                </Text>
                <Text style={styles.modalFeeLabel}>
                  (Taxa plataforma: R$ {paymentResult.fee.toFixed(2)})
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.modalSubmitButton,
                rating === 0 && styles.modalSubmitButtonDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleSubmitRating}
              disabled={rating === 0}
            >
              <Text style={styles.modalSubmitText}>Enviar Avaliação</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 20,
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
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.primary,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  goGlobalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
    marginTop: 6,
  },
  goGlobalButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  activeCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
  },
  activeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  statusDotCompleted: {
    backgroundColor: C.warning,
  },
  statusDotRated: {
    backgroundColor: C.success,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  activeTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  activeDescription: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 21,
  },
  activeMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  activeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeMetaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  valueBox: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  valueBoxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  valueBoxLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  valueBoxAmount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  valueBoxTotal: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 2,
  },
  valueBoxTotalLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  valueBoxTotalAmount: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
  },
  chatButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  finalizeButton: {
    backgroundColor: C.success,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finalizeButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  completedActions: {
    gap: 12,
  },
  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.warningLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.warning,
  },
  completedBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.warning,
    flex: 1,
  },
  confirmPaymentButton: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmPaymentText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  completedFinalBox: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  completedFinalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.successLight,
    alignItems: "center",
    justifyContent: "center",
  },
  completedFinalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  completedFinalValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    gap: 20,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: C.border,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },
  modalPaymentBox: {
    backgroundColor: C.successLight,
    borderRadius: 14,
    padding: 16,
    width: "100%",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: C.success,
  },
  modalPaymentLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  modalPaymentValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  modalFeeLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  modalSubmitButton: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
  },
  modalSubmitButtonDisabled: {
    opacity: 0.4,
  },
  modalSubmitText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
});
