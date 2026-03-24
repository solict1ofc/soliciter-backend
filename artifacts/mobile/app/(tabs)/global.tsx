import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { ALL_CITY_NAMES, getNeighborhoods } from "@/constants/locations";
import { useApp } from "@/context/AppContext";
import type { Service } from "@/context/AppContext";

const C = Colors.dark;

// ─── Pulsing border for urgent ────────────────────────────────────────────────
function UrgentBorder() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.urgentBorderAnim, { opacity: anim }]}
      pointerEvents="none"
    />
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────
function FilterChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {active && <Ionicons name="checkmark" size={12} color="#000" />}
    </Pressable>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
function FilterSheet({
  visible, onClose,
  selectedCity, selectedNeighborhood,
  onCitySelect, onNeighborhoodSelect, onClear,
}: {
  visible: boolean; onClose: () => void;
  selectedCity: string; selectedNeighborhood: string;
  onCitySelect: (c: string) => void;
  onNeighborhoodSelect: (n: string) => void;
  onClear: () => void;
}) {
  const insets = useSafeAreaInsets();
  const neighborhoods = useMemo(() => getNeighborhoods(selectedCity), [selectedCity]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={[styles.filterSheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filtrar por Localização</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(selectedCity || selectedNeighborhood) && (
              <Pressable style={styles.clearBtn} onPress={() => { onClear(); onClose(); }}>
                <Text style={styles.clearBtnText}>Limpar</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* City section */}
        <Text style={styles.filterSectionLabel}>Cidade</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingRight: 20 }}>
            <FilterChip
              label="Todas"
              active={!selectedCity}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCitySelect(""); onNeighborhoodSelect(""); }}
            />
            {ALL_CITY_NAMES.map((c) => (
              <FilterChip
                key={c}
                label={c}
                active={selectedCity === c}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onCitySelect(c);
                  onNeighborhoodSelect("");
                }}
              />
            ))}
          </View>
        </ScrollView>

        {/* Neighborhood section (only when city selected) */}
        {selectedCity && neighborhoods.length > 0 && (
          <>
            <Text style={styles.filterSectionLabel}>Bairro em {selectedCity}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
            >
              <View style={{ flexDirection: "row", gap: 8, paddingRight: 20 }}>
                <FilterChip
                  label="Todos os bairros"
                  active={!selectedNeighborhood}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNeighborhoodSelect(""); }}
                />
                {neighborhoods.map((n) => (
                  <FilterChip
                    key={n}
                    label={n}
                    active={selectedNeighborhood === n}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNeighborhoodSelect(n); }}
                  />
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.85 }]}
          onPress={onClose}
        >
          <Text style={styles.applyBtnText}>Aplicar Filtros</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({ service, onAccept }: { service: Service; onAccept: () => void }) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return `${Math.floor(hrs / 24)}d atrás`;
  };

  return (
    <View style={[styles.card, service.urgent && styles.urgentCard]}>
      {service.urgent && <UrgentBorder />}
      {service.urgent && (
        <View style={styles.urgentBanner}>
          <Ionicons name="flash" size={13} color={C.danger} />
          <Text style={styles.urgentBannerText}>PREÇO COM URGÊNCIA</Text>
          <Ionicons name="flash" size={13} color={C.danger} />
        </View>
      )}

      <View style={styles.cardHeader}>
        <View style={styles.cardTitleArea}>
          <Text style={styles.cardTitle} numberOfLines={1}>{service.title}</Text>
          <Text style={styles.cardTime}>{timeAgo(service.createdAt)}</Text>
        </View>
        <View style={[styles.valueBadge, service.urgent && styles.valueBadgeUrgent]}>
          <Text style={[styles.valueBadgeText, service.urgent && styles.valueBadgeTextUrgent]}>
            R$ {service.finalValue.toFixed(2)}
          </Text>
        </View>
      </View>

      <Text style={styles.cardDescription} numberOfLines={3}>{service.description}</Text>

      <View style={styles.cardMeta}>
        <View style={styles.metaTag}>
          <Ionicons name="location-outline" size={12} color={C.primary} />
          <Text style={styles.metaTagText}>{service.city}</Text>
        </View>
        <View style={styles.metaTag}>
          <Ionicons name="navigate-outline" size={12} color={C.textSecondary} />
          <Text style={styles.metaTagText}>{service.neighborhood}</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.acceptButton,
          service.urgent && styles.acceptButtonUrgent,
          pressed && styles.acceptButtonPressed,
        ]}
        onPress={onAccept}
      >
        <View style={styles.acceptButtonInner}>
          <Ionicons
            name={service.urgent ? "flash" : "checkmark-circle-outline"}
            size={22}
            color="#000"
          />
          <View>
            <Text style={styles.acceptButtonText}>Aceitar Serviço</Text>
            <Text style={styles.acceptButtonSub}>
              Receber R$ {service.finalValue.toFixed(2)}
            </Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-circle" size={24} color="rgba(0,0,0,0.4)" />
      </Pressable>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GlobalScreen() {
  const insets = useSafeAreaInsets();
  const { availableServices, acceptService, provider } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCity, setFilterCity] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");

  const filteredServices = useMemo(() => {
    let list = availableServices;
    if (filterCity) list = list.filter((s) => s.city === filterCity);
    if (filterNeighborhood) list = list.filter((s) => s.neighborhood === filterNeighborhood);
    const urgent = list.filter((s) => s.urgent);
    const regular = list.filter((s) => !s.urgent);
    return [...urgent, ...regular];
  }, [availableServices, filterCity, filterNeighborhood]);

  const hasFilter = !!filterCity || !!filterNeighborhood;

  const handleAccept = async (service: Service) => {
    if (provider.activeServiceId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const success = await acceptService(service.id);
    if (success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  const filterLabel = filterCity
    ? filterNeighborhood
      ? `${filterNeighborhood}, ${filterCity}`
      : filterCity
    : "Todos os locais";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mercado Global</Text>
          <Text style={styles.headerSubtitle}>
            {filteredServices.length} serviço{filteredServices.length !== 1 ? "s" : ""} disponível{filteredServices.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>AO VIVO</Text>
        </View>
      </View>

      {/* ── Filter bar ── */}
      <Pressable
        style={({ pressed }) => [styles.filterBar, hasFilter && styles.filterBarActive, pressed && { opacity: 0.85 }]}
        onPress={() => setFilterVisible(true)}
      >
        <Ionicons
          name="filter"
          size={16}
          color={hasFilter ? C.primary : C.textSecondary}
        />
        <Text style={[styles.filterBarText, hasFilter && { color: C.primary }]} numberOfLines={1}>
          {filterLabel}
        </Text>
        {hasFilter ? (
          <Pressable
            style={styles.clearFilterBtn}
            hitSlop={10}
            onPress={() => { setFilterCity(""); setFilterNeighborhood(""); }}
          >
            <Ionicons name="close-circle" size={16} color={C.primary} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={16} color={C.textTertiary} />
        )}
      </Pressable>

      {/* ── Provider blocked banner ── */}
      {provider.activeServiceId && (
        <View style={styles.blockedBanner}>
          <Ionicons name="lock-closed" size={16} color={C.warning} />
          <Text style={styles.blockedBannerText}>
            Finalize o serviço atual para aceitar outro
          </Text>
        </View>
      )}

      <FlatList
        data={filteredServices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              {hasFilter ? (
                <Ionicons name="search" size={40} color={C.textMuted} />
              ) : (
                <Ionicons name="archive-outline" size={40} color={C.textMuted} />
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {hasFilter ? "Nenhum serviço nessa região" : "Nenhum serviço disponível"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {hasFilter
                ? "Tente ampliar o filtro ou remover o bairro"
                : "Novos serviços aparecerão aqui assim que forem publicados"}
            </Text>
            {hasFilter && (
              <Pressable
                style={styles.clearFilterBtnLarge}
                onPress={() => { setFilterCity(""); setFilterNeighborhood(""); }}
              >
                <Text style={styles.clearFilterBtnLargeText}>Limpar Filtro</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ServiceCard service={item} onAccept={() => handleAccept(item)} />
        )}
      />

      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCity={filterCity}
        selectedNeighborhood={filterNeighborhood}
        onCitySelect={setFilterCity}
        onNeighborhoodSelect={setFilterNeighborhood}
        onClear={() => { setFilterCity(""); setFilterNeighborhood(""); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 230, 118, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.success, letterSpacing: 1 },

  // Filter bar
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterBarActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryGlow,
  },
  filterBarText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  clearFilterBtn: { padding: 2 },

  // Blocked banner
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: C.warningLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.warning,
  },
  blockedBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.warning, flex: 1 },

  // Cards
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
    overflow: "hidden",
  },
  urgentCard: { borderColor: C.urgentBorder, backgroundColor: "rgba(255, 59, 92, 0.05)" },
  urgentBorderAnim: { borderRadius: 18, borderWidth: 2, borderColor: C.urgentBorder },
  urgentBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.dangerLight,
    borderRadius: 8,
    paddingVertical: 6,
  },
  urgentBannerText: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.danger, letterSpacing: 1.5 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  cardTitleArea: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textTertiary },
  valueBadge: {
    backgroundColor: C.primaryGlow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.primary,
  },
  valueBadgeUrgent: { backgroundColor: C.dangerLight, borderColor: C.danger },
  valueBadgeText: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.primary },
  valueBadgeTextUrgent: { color: C.danger },
  cardDescription: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 21 },
  cardMeta: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  metaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaTagText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  acceptButton: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  acceptButtonInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  acceptButtonUrgent: { backgroundColor: C.danger },
  acceptButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  acceptButtonText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
  acceptButtonSub: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(0,0,0,0.6)", marginTop: 2 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 16 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 32,
  },
  clearFilterBtnLarge: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
  },
  clearFilterBtnLargeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  filterSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.dangerLight,
    borderWidth: 1,
    borderColor: C.danger,
  },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.danger },
  filterSectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary, maxWidth: 160 },
  chipTextActive: { color: "#000", fontFamily: "Inter_700Bold" },
  applyBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  applyBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
});
