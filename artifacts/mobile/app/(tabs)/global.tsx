import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
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
import { SoliciteLogo } from "@/components/SoliciteLogo";

const C = Colors.dark;

const USER_CITY = "Goiânia"; // default user city

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
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
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

        {selectedCity && neighborhoods.length > 0 && (
          <>
            <Text style={styles.filterSectionLabel}>Bairro em {selectedCity}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
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

        <Pressable style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.85 }]} onPress={onClose}>
          <Text style={styles.applyBtnText}>Aplicar Filtros</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({
  service, onAccept, userCity,
}: {
  service: Service;
  onAccept: () => void;
  userCity: string;
}) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return `${Math.floor(hrs / 24)}d atrás`;
  };

  const isNearby = service.city === userCity;

  return (
    <View style={[styles.card, service.urgent && styles.urgentCard]}>
      {service.urgent && <UrgentBorder />}

      {/* Top badges row */}
      <View style={styles.topBadgesRow}>
        {service.urgent && (
          <View style={styles.urgentBadge}>
            <Ionicons name="flash" size={12} color={C.danger} />
            <Text style={styles.urgentBadgeText}>URGENTE</Text>
          </View>
        )}
        {isNearby && (
          <View style={styles.nearbyBadge}>
            <Ionicons name="location" size={12} color={C.success} />
            <Text style={styles.nearbyBadgeText}>Perto de você</Text>
          </View>
        )}
      </View>

      {/* Title + value */}
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

      <Text style={styles.cardDescription} numberOfLines={2}>{service.description}</Text>

      {/* Location row — always prominent */}
      <View style={styles.locationRow}>
        <View style={styles.locationPill}>
          <Ionicons name="location" size={13} color={C.primary} />
          <Text style={styles.locationCity}>{service.city}</Text>
        </View>
        <Ionicons name="chevron-forward" size={12} color={C.textMuted} />
        <View style={styles.locationNeighborhood}>
          <Ionicons name="navigate" size={12} color={C.textSecondary} />
          <Text style={styles.locationNeighborhoodText}>{service.neighborhood}</Text>
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

// ─── Section Header ───────────────────────────────────────────────────────────
function CityHeader({ title, count, isUserCity }: { title: string; count: number; isUserCity: boolean }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Ionicons
          name={isUserCity ? "location" : "globe-outline"}
          size={15}
          color={isUserCity ? C.primary : C.textSecondary}
        />
        <Text style={[styles.sectionHeaderTitle, isUserCity && { color: C.primary }]}>
          {isUserCity ? `📍 ${title}` : title}
        </Text>
      </View>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
type Section = { title: string; data: Service[]; isUserCity: boolean };
type QuickFilter = "nearby" | "all";

export default function GlobalScreen() {
  const insets = useSafeAreaInsets();
  const { availableServices, acceptService, provider } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCity, setFilterCity] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("nearby");

  // Sort: urgent first, then user's city, then by value desc
  const sortedServices = useMemo(() => {
    return [...availableServices].sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      const aLocal = a.city === USER_CITY ? 1 : 0;
      const bLocal = b.city === USER_CITY ? 1 : 0;
      if (aLocal !== bLocal) return bLocal - aLocal;
      return b.finalValue - a.finalValue;
    });
  }, [availableServices]);

  // Apply filters (city sheet + quick filter)
  const afterFilter = useMemo(() => {
    let list = sortedServices;
    if (quickFilter === "nearby") list = list.filter((s) => s.city === USER_CITY);
    if (filterCity) list = list.filter((s) => s.city === filterCity);
    if (filterNeighborhood) list = list.filter((s) => s.neighborhood === filterNeighborhood);
    return list;
  }, [sortedServices, quickFilter, filterCity, filterNeighborhood]);

  // Build sections: user's city first, then other cities
  const sections = useMemo((): Section[] => {
    if (filterCity || filterNeighborhood || quickFilter === "nearby") {
      // Single section when filtered
      return [{ title: filterCity || USER_CITY, data: afterFilter, isUserCity: true }];
    }
    // Group by city
    const cityMap = new Map<string, Service[]>();
    afterFilter.forEach((s) => {
      if (!cityMap.has(s.city)) cityMap.set(s.city, []);
      cityMap.get(s.city)!.push(s);
    });
    const result: Section[] = [];
    // User's city first
    if (cityMap.has(USER_CITY)) {
      result.push({ title: USER_CITY, data: cityMap.get(USER_CITY)!, isUserCity: true });
      cityMap.delete(USER_CITY);
    }
    // Remaining cities
    for (const [city, services] of cityMap) {
      result.push({ title: city, data: services, isUserCity: false });
    }
    return result;
  }, [afterFilter, filterCity, filterNeighborhood, quickFilter]);

  const totalCount = sections.reduce((sum, s) => sum + s.data.length, 0);
  const hasAdvancedFilter = !!filterCity || !!filterNeighborhood;

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ gap: 4 }}>
          <SoliciteLogo size="sm" />
          <Text style={styles.headerSubtitle}>
            {totalCount} serviço{totalCount !== 1 ? "s" : ""} disponível{totalCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>AO VIVO</Text>
        </View>
      </View>

      {/* ── Quick filter row ── */}
      <View style={styles.quickFilterRow}>
        <Pressable
          style={[styles.quickBtn, quickFilter === "nearby" && styles.quickBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQuickFilter("nearby"); setFilterCity(""); setFilterNeighborhood(""); }}
        >
          <Ionicons
            name="location"
            size={14}
            color={quickFilter === "nearby" ? "#000" : C.textSecondary}
          />
          <Text style={[styles.quickBtnText, quickFilter === "nearby" && styles.quickBtnTextActive]}>
            Minha cidade
          </Text>
        </Pressable>

        <Pressable
          style={[styles.quickBtn, quickFilter === "all" && styles.quickBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQuickFilter("all"); setFilterCity(""); setFilterNeighborhood(""); }}
        >
          <Ionicons
            name="globe"
            size={14}
            color={quickFilter === "all" ? "#000" : C.textSecondary}
          />
          <Text style={[styles.quickBtnText, quickFilter === "all" && styles.quickBtnTextActive]}>
            Todos os locais
          </Text>
        </Pressable>

        <Pressable
          style={[styles.quickBtn, hasAdvancedFilter && styles.quickBtnFilter]}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons
            name="options"
            size={14}
            color={hasAdvancedFilter ? C.primary : C.textSecondary}
          />
          {hasAdvancedFilter && (
            <View style={styles.filterDot} />
          )}
        </Pressable>
      </View>

      {/* Active advanced filter banner */}
      {hasAdvancedFilter && (
        <View style={styles.filterBanner}>
          <Ionicons name="filter" size={14} color={C.primary} />
          <Text style={styles.filterBannerText} numberOfLines={1}>
            {filterNeighborhood ? `${filterNeighborhood}, ${filterCity}` : filterCity}
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => { setFilterCity(""); setFilterNeighborhood(""); }}
          >
            <Ionicons name="close-circle" size={16} color={C.primary} />
          </Pressable>
        </View>
      )}

      {/* ── Provider blocked banner ── */}
      {provider.activeServiceId && (
        <View style={styles.blockedBanner}>
          <Ionicons name="lock-closed" size={16} color={C.warning} />
          <Text style={styles.blockedBannerText}>
            Finalize o serviço atual para aceitar outro
          </Text>
        </View>
      )}

      {/* ── Sectioned list ── */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />
        }
        renderSectionHeader={({ section }) =>
          sections.length > 1 ? (
            <CityHeader
              title={section.title}
              count={section.data.length}
              isUserCity={section.isUserCity}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ServiceCard
            service={item}
            userCity={USER_CITY}
            onAccept={() => handleAccept(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              {quickFilter === "nearby" ? (
                <Ionicons name="location-outline" size={40} color={C.textMuted} />
              ) : (
                <Ionicons name="archive-outline" size={40} color={C.textMuted} />
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {quickFilter === "nearby"
                ? `Nenhum serviço em ${USER_CITY}`
                : "Nenhum serviço disponível"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {quickFilter === "nearby"
                ? "Tente buscar em todos os locais ou amplie o filtro"
                : "Novos serviços aparecerão aqui assim que forem publicados"}
            </Text>
            {quickFilter === "nearby" && (
              <Pressable
                style={styles.clearFilterBtnLarge}
                onPress={() => setQuickFilter("all")}
              >
                <Text style={styles.clearFilterBtnLargeText}>Ver todos os locais</Text>
              </Pressable>
            )}
          </View>
        }
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

  // Quick filter
  quickFilterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: "center",
  },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.border,
    position: "relative",
  },
  quickBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  quickBtnFilter: {
    borderColor: C.primary,
    backgroundColor: C.primaryGlow,
    paddingHorizontal: 12,
  },
  quickBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  quickBtnTextActive: { color: "#000" },
  filterDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.primary,
  },

  // Active filter banner
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: C.primaryGlow,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.primary + "60",
  },
  filterBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: C.primary },

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

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionHeaderTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.textSecondary, letterSpacing: 0.3 },
  sectionBadge: {
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: C.textSecondary },

  // Cards
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
    overflow: "hidden",
  },
  urgentCard: { borderColor: C.urgentBorder, backgroundColor: "rgba(255, 59, 92, 0.05)" },
  urgentBorderAnim: { borderRadius: 18, borderWidth: 2, borderColor: C.urgentBorder },

  // Top badges row
  topBadgesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.dangerLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.danger,
  },
  urgentBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.danger, letterSpacing: 1.2 },
  nearbyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.successLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.success,
  },
  nearbyBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.success },

  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  cardTitleArea: { flex: 1, gap: 3 },
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
  cardDescription: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 20 },

  // Location row (prominent)
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  locationPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  locationCity: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.primary },
  locationNeighborhood: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  locationNeighborhoodText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },

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
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  emptySubtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary,
    textAlign: "center", lineHeight: 21, paddingHorizontal: 32,
  },
  clearFilterBtnLarge: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.primary,
  },
  clearFilterBtnLargeText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  filterSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: C.border,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: "center", marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.dangerLight, borderWidth: 1, borderColor: C.danger,
  },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.danger },
  filterSectionLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: C.textTertiary,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.backgroundTertiary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary, maxWidth: 160 },
  chipTextActive: { color: "#000", fontFamily: "Inter_700Bold" },
  applyBtn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 16,
  },
  applyBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
});
