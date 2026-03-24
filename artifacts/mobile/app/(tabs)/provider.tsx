import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { Service } from "@/context/AppContext";
import { SoliciteLogo } from "@/components/SoliciteLogo";

const C = Colors.dark;

function InfoRow({ icon, label, value, valueColor }: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon as any} size={14} color={C.primary} />
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoRowValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

function ServiceBlock({ service }: { service: Service }) {
  const { startService, finalizeService, provider, PLATFORM_FEE_RATE } = useApp();
  const [starting, setStarting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const fee = provider.plan === "free"
    ? service.finalValue * PLATFORM_FEE_RATE
    : 0;
  const providerEarning = service.finalValue - fee;

  const handleStart = () => {
    Alert.alert(
      "Iniciar Serviço",
      "Confirme que você está iniciando a execução do serviço.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Iniciar",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setStarting(true);
            await startService(service.id);
            setStarting(false);
          },
        },
      ]
    );
  };

  const handleFinalize = () => {
    Alert.alert(
      "Finalizar Serviço",
      "Confirme que o serviço foi concluído. O cliente será notificado para confirmar o pagamento.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          style: "default",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setFinalizing(true);
            await finalizeService(service.id);
            setFinalizing(false);
          },
        },
      ]
    );
  };

  const isAccepted = service.status === "accepted";
  const isInProgress = service.status === "in_progress";
  const isCompleted = service.status === "completed";
  const isRated = service.status === "rated";

  return (
    <View style={styles.activeCard}>
      {/* Status pill */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusPill,
            isAccepted && styles.statusPillAccepted,
            isInProgress && styles.statusPillInProgress,
            isCompleted && styles.statusPillCompleted,
            isRated && styles.statusPillRated,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isAccepted && { backgroundColor: C.accent },
              isInProgress && { backgroundColor: C.primary },
              isCompleted && { backgroundColor: C.warning },
              isRated && { backgroundColor: C.success },
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              isAccepted && { color: C.accent },
              isInProgress && { color: C.primary },
              isCompleted && { color: C.warning },
              isRated && { color: C.success },
            ]}
          >
            {isAccepted
              ? "Aceito"
              : isInProgress
              ? "Em andamento"
              : isCompleted
              ? "Aguardando cliente"
              : "Concluído"}
          </Text>
        </View>
        {service.urgent && (
          <View style={styles.urgentPill}>
            <Ionicons name="flash" size={11} color={C.danger} />
            <Text style={styles.urgentPillText}>Urgente</Text>
          </View>
        )}
      </View>

      <Text style={styles.activeTitle}>{service.title}</Text>
      <Text style={styles.activeDesc} numberOfLines={3}>
        {service.description}
      </Text>

      <View style={styles.infoGrid}>
        <InfoRow icon="location-outline" label="Cidade" value={service.city} />
        <InfoRow icon="navigate-outline" label="Bairro" value={service.neighborhood} />
        <InfoRow
          icon="time-outline"
          label="Aceito em"
          value={
            service.acceptedAt
              ? new Date(service.acceptedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
                })
              : "-"
          }
        />
      </View>

      {/* Earnings breakdown */}
      <View style={styles.earningsBox}>
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Valor do serviço</Text>
          <Text style={styles.earningsValue}>R$ {service.finalValue.toFixed(2)}</Text>
        </View>
        {provider.plan === "free" && (
          <View style={styles.earningsRow}>
            <Text style={[styles.earningsLabel, { color: C.danger }]}>
              Taxa plataforma (10%)
            </Text>
            <Text style={[styles.earningsValue, { color: C.danger }]}>
              -R$ {fee.toFixed(2)}
            </Text>
          </View>
        )}
        {provider.plan !== "free" && (
          <View style={styles.earningsRow}>
            <Text style={[styles.earningsLabel, { color: C.success }]}>
              Taxa plataforma
            </Text>
            <Text style={[styles.earningsValue, { color: C.success }]}>
              Isento (plano ativo)
            </Text>
          </View>
        )}
        <View style={[styles.earningsRow, styles.earningsTotalRow]}>
          <Text style={styles.earningsTotalLabel}>Você recebe</Text>
          <Text style={styles.earningsTotalValue}>
            R$ {providerEarning.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Custódia info */}
      {(isAccepted || isInProgress) && (
        <View style={styles.escrowInfo}>
          <Ionicons name="lock-closed-outline" size={15} color={C.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.escrowInfoTitle}>
              R$ {providerEarning.toFixed(2)} em custódia
            </Text>
            <Text style={styles.escrowInfoDesc}>
              Será liberado quando o cliente confirmar o serviço
            </Text>
          </View>
        </View>
      )}

      {/* Chat button — available after acceptance */}
      {(isAccepted || isInProgress || service.status === "completed") && (
        <Pressable
          style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push(`/chat/${service.id}?role=provider` as any)}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.primary} />
            <Text style={styles.chatBtnText}>Chat com o Cliente</Text>
          </View>
          {(service.unreadProvider ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{service.unreadProvider}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward-outline" size={15} color={C.textMuted} />
        </Pressable>
      )}

      {/* ── INICIAR SERVIÇO ── */}
      {isAccepted && (
        <Pressable
          style={({ pressed }) => [styles.bigActionBtn, { backgroundColor: C.accent }, pressed && styles.actionBtnPressed]}
          onPress={handleStart}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <View style={styles.bigActionBtnInner}>
              <View style={styles.bigActionIconWrap}>
                <Ionicons name="play-circle" size={36} color="#fff" />
              </View>
              <View>
                <Text style={[styles.bigActionBtnTitle, { color: "#fff" }]}>Iniciar Serviço</Text>
                <Text style={[styles.bigActionBtnSub, { color: "rgba(255,255,255,0.7)" }]}>
                  Toque para confirmar início
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      )}

      {/* ── FINALIZAR SERVIÇO ── */}
      {isInProgress && (
        <Pressable
          style={({ pressed }) => [styles.bigActionBtn, { backgroundColor: C.success }, pressed && styles.actionBtnPressed]}
          onPress={handleFinalize}
          disabled={finalizing}
        >
          {finalizing ? (
            <ActivityIndicator color="#000" size="large" />
          ) : (
            <View style={styles.bigActionBtnInner}>
              <View style={[styles.bigActionIconWrap, { backgroundColor: "rgba(0,0,0,0.15)" }]}>
                <Ionicons name="checkmark-done-circle" size={36} color="#000" />
              </View>
              <View>
                <Text style={styles.bigActionBtnTitle}>Finalizar Serviço</Text>
                <Text style={styles.bigActionBtnSub}>Serviço concluído? Toque aqui</Text>
              </View>
            </View>
          )}
        </Pressable>
      )}

      {isCompleted && (
        <View style={styles.awaitingBox}>
          <Ionicons name="hourglass-outline" size={22} color={C.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.awaitingTitle}>Aguardando confirmação do cliente</Text>
            <Text style={styles.awaitingDesc}>
              O cliente precisa confirmar e liberar o pagamento de R$ {providerEarning.toFixed(2)}.
            </Text>
          </View>
        </View>
      )}

      {isRated && (
        <View style={styles.doneBox}>
          <View style={styles.doneIconWrap}>
            <Ionicons name="checkmark-circle" size={40} color={C.success} />
          </View>
          <Text style={styles.doneTitle}>Pagamento recebido!</Text>
          <Text style={styles.doneValue}>+R$ {providerEarning.toFixed(2)}</Text>
          {service.clientRating !== undefined && (
            <View style={styles.clientRatingRow}>
              <Text style={styles.clientRatingLabel}>Avaliação do cliente:</Text>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= service.clientRating! ? "star" : "star-outline"}
                  size={18}
                  color={s <= service.clientRating! ? C.gold : C.textMuted}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── History card ─────────────────────────────────────────────────────────────
function HistoryCard({ service }: { service: Service }) {
  const { provider, PLATFORM_FEE_RATE } = useApp();
  const fee = provider.plan === "free" ? service.finalValue * PLATFORM_FEE_RATE : 0;
  const earned = service.finalValue - fee;
  const date = new Date(service.ratedAt ?? service.completedAt ?? service.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const isRated = service.status === "rated";

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyCardHeader}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.historyCardTitle} numberOfLines={1}>{service.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="location-outline" size={11} color={C.textTertiary} />
            <Text style={styles.historyCardMeta}>{service.neighborhood}, {service.city}</Text>
          </View>
        </View>
        <View style={styles.historyEarned}>
          <Text style={styles.historyEarnedValue}>+R$ {earned.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.historyCardRow}>
        <View style={[
          styles.historyStatusPill,
          isRated ? styles.historyStatusRated : styles.historyStatusCompleted,
        ]}>
          <Ionicons
            name={isRated ? "checkmark-circle" : "hourglass-outline"}
            size={12}
            color={isRated ? C.success : C.warning}
          />
          <Text style={[styles.historyStatusText, { color: isRated ? C.success : C.warning }]}>
            {isRated ? "Pago" : "Aguardando"}
          </Text>
        </View>

        <Text style={styles.historyDate}>{dateStr}</Text>
      </View>

      {service.clientRating !== undefined && (
        <View style={styles.historyRatingRow}>
          <Text style={styles.historyRatingLabel}>Avaliação:</Text>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= service.clientRating! ? "star" : "star-outline"}
              size={14}
              color={s <= service.clientRating! ? C.gold : C.textMuted}
            />
          ))}
          <Text style={styles.historyRatingNum}>{service.clientRating}/5</Text>
        </View>
      )}
    </View>
  );
}

function ProviderRegisterGate() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <SoliciteLogo size="sm" />
        <Text style={styles.headerSubtitle}>Área do Prestador</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.gateIconBox}>
          <Ionicons name="person-add" size={44} color="#000" />
        </View>

        <Text style={styles.gateTitle}>Cadastre-se como Prestador</Text>
        <Text style={styles.gateDesc}>
          Para aceitar serviços e ganhar dinheiro na SOLICITE, você precisa criar
          seu perfil de prestador. O processo é rápido e seguro.
        </Text>

        {/* Benefits */}
        <View style={styles.gateBenefits}>
          {[
            { icon: "briefcase-outline",     text: "Aceite serviços na sua área" },
            { icon: "cash-outline",          text: "Receba pagamentos com segurança" },
            { icon: "star-outline",          text: "Construa sua reputação" },
            { icon: "shield-checkmark-outline", text: "Plataforma verificada e segura" },
          ].map((b) => (
            <View key={b.icon} style={styles.gateBenefitRow}>
              <View style={styles.gateBenefitIcon}>
                <Ionicons name={b.icon as any} size={16} color={C.primary} />
              </View>
              <Text style={styles.gateBenefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.gateBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/provider-register")}
        >
          <Ionicons name="arrow-forward-circle-outline" size={22} color="#000" />
          <Text style={styles.gateBtnText}>Iniciar Cadastro</Text>
        </Pressable>

        <Text style={styles.gateFootnote}>
          Seus dados são protegidos por criptografia e nunca compartilhados com terceiros.
        </Text>
      </ScrollView>
    </View>
  );
}

export default function ProviderScreen() {
  const insets = useSafeAreaInsets();
  const { activeService, provider, services } = useApp();
  const [tab, setTab] = useState<"ativo" | "historico">("ativo");

  // Hooks must always run — before any conditional return
  const historyServices = useMemo(() => {
    return [...services]
      .filter((s) =>
        (s.status === "rated" || s.status === "completed") &&
        (s.providerId === provider.id || s.id === activeService?.id)
      )
      .sort((a, b) =>
        new Date(b.ratedAt ?? b.completedAt ?? b.createdAt).getTime() -
        new Date(a.ratedAt ?? a.completedAt ?? a.createdAt).getTime()
      );
  }, [services, provider.id, activeService?.id]);

  const totalEarnedSession = useMemo(() => {
    return historyServices
      .filter((s) => s.status === "rated")
      .reduce((sum, s) => {
        const fee = provider.plan === "free" ? s.finalValue * 0.1 : 0;
        return sum + (s.finalValue - fee);
      }, 0);
  }, [historyServices, provider.plan]);

  // Gate: require registration (after all hooks)
  if (!provider.registered) {
    return <ProviderRegisterGate />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <SoliciteLogo size="sm" />
        <Text style={styles.headerSubtitle}>
          {activeService ? "Serviço ativo em andamento" : "Nenhum serviço ativo"}
        </Text>
      </View>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{provider.completedJobs}</Text>
          <Text style={styles.statLabel}>Concluídos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: C.success, fontSize: 15 }]}>
            R$ {provider.earnings.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </Text>
          <Text style={styles.statLabel}>Total ganho</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{provider.rating} ⭐</Text>
          <Text style={styles.statLabel}>Avaliação</Text>
        </View>
      </View>

      {/* ── Tab switcher ── */}
      <View style={styles.tabRow}>
        {([
          { key: "ativo" as const,    label: "Serviço Ativo" },
          { key: "historico" as const, label: `Histórico (${historyServices.length})` },
        ]).map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t.key); }}
          >
            <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Tab: Ativo ── */}
      {tab === "ativo" && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {!activeService ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="briefcase-outline" size={40} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Sem serviço ativo</Text>
              <Text style={styles.emptyDesc}>
                Vá para o Mercado Global e aceite um serviço disponível para começar a trabalhar
              </Text>
              <Pressable
                style={({ pressed }) => [styles.goGlobalBtn, pressed && { opacity: 0.7 }]}
                onPress={() => router.push("/(tabs)/global")}
              >
                <Ionicons name="globe-outline" size={15} color={C.primary} />
                <Text style={styles.goGlobalText}>Ver Mercado Global</Text>
              </Pressable>
            </View>
          ) : (
            <ServiceBlock service={activeService} />
          )}

          {/* Flow guide */}
          <View style={styles.flowGuide}>
            <Text style={styles.flowGuideTitle}>Fluxo do Serviço</Text>
            {[
              { icon: "globe-outline",            label: "Serviço disponível no Global",  done: true },
              { icon: "person-add-outline",       label: "Você aceita o serviço",         done: !!activeService },
              { icon: "play-outline",             label: "Inicia a execução",              done: activeService?.status === "in_progress" || activeService?.status === "completed" || activeService?.status === "rated" },
              { icon: "checkmark-circle-outline", label: "Finaliza o serviço",           done: activeService?.status === "completed" || activeService?.status === "rated" },
              { icon: "cash-outline",             label: "Cliente confirma e libera",      done: activeService?.status === "rated" },
            ].map((step, i) => (
              <View key={i} style={styles.flowStep}>
                <View style={[styles.flowStepIcon, step.done && styles.flowStepIconDone]}>
                  <Ionicons name={step.icon as any} size={14} color={step.done ? "#000" : C.textMuted} />
                </View>
                <Text style={[styles.flowStepText, step.done && { color: C.text }]}>
                  {step.label}
                </Text>
                {step.done && <Ionicons name="checkmark-circle" size={16} color={C.success} />}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Tab: Histórico ── */}
      {tab === "historico" && (
        <FlatList
          data={historyServices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            historyServices.length > 0 ? (
              <View style={styles.historySummary}>
                <View style={styles.historySummaryItem}>
                  <Text style={styles.historySummaryValue}>{historyServices.filter(s => s.status === "rated").length}</Text>
                  <Text style={styles.historySummaryLabel}>Pagos</Text>
                </View>
                <View style={styles.historySummarySep} />
                <View style={styles.historySummaryItem}>
                  <Text style={[styles.historySummaryValue, { color: C.success }]}>
                    R$ {totalEarnedSession.toFixed(2)}
                  </Text>
                  <Text style={styles.historySummaryLabel}>Recebido nesta sessão</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={36} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Nenhum histórico</Text>
              <Text style={styles.emptyDesc}>
                Seus serviços concluídos aparecerão aqui com valor e data
              </Text>
            </View>
          }
          renderItem={({ item }) => <HistoryCard service={item} />}
        />
      )}
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
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 16,
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
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: C.primary,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  goGlobalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
    marginTop: 4,
  },
  goGlobalText: {
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
  statusRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusPillAccepted: {
    backgroundColor: C.accentLight,
    borderColor: C.accent,
  },
  statusPillInProgress: {
    backgroundColor: C.primaryGlow,
    borderColor: C.primary,
  },
  statusPillCompleted: {
    backgroundColor: C.warningLight,
    borderColor: C.warning,
  },
  statusPillRated: {
    backgroundColor: C.successLight,
    borderColor: C.success,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.textMuted,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  urgentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.dangerLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.danger,
  },
  urgentPillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: C.danger,
  },
  activeTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  activeDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 21,
  },
  infoGrid: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  infoRowLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  infoRowValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
  },
  earningsBox: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  earningsLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  earningsValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  earningsTotalRow: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 2,
  },
  earningsTotalLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  earningsTotalValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  escrowInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,184,0,0.1)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.3)",
  },
  escrowInfoTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: C.warning,
    marginBottom: 2,
  },
  escrowInfoDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.warning,
    opacity: 0.8,
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primaryGlow,
  },
  chatBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  unreadBadge: {
    backgroundColor: C.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  bigActionBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  bigActionBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bigActionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bigActionBtnTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#000",
    marginBottom: 3,
  },
  bigActionBtnSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(0,0,0,0.6)",
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  actionBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  awaitingBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: C.warningLight,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.warning,
  },
  awaitingTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.warning,
    marginBottom: 4,
  },
  awaitingDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.warning,
    lineHeight: 19,
    opacity: 0.85,
  },
  doneBox: {
    backgroundColor: C.successLight,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.success,
  },
  doneIconWrap: {
    marginBottom: 4,
  },
  doneTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  doneValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  clientRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  clientRatingLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginRight: 2,
  },
  flowGuide: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  flowGuideTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  flowStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flowStepIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  flowStepIconDone: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  flowStepText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    flex: 1,
  },
  // TAB SWITCHER
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
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
    fontFamily: "Inter_700Bold",
  },
  // HISTORY
  historySummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  historySummaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  historySummarySep: {
    width: 1,
    height: 36,
    backgroundColor: C.border,
  },
  historySummaryValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  historySummaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },
  historyCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  historyCardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  historyCardMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  historyEarned: {
    backgroundColor: C.successLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.success,
  },
  historyEarnedValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: C.success,
  },
  historyCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  historyStatusRated: {
    backgroundColor: C.successLight,
    borderColor: C.success,
  },
  historyStatusCompleted: {
    backgroundColor: C.warningLight,
    borderColor: C.warning,
  },
  historyStatusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  historyDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  historyRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyRatingLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginRight: 4,
  },
  historyRatingNum: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.gold,
    marginLeft: 4,
  },
});
