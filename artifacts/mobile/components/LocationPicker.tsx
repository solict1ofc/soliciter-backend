import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { ALL_CITY_NAMES, getNeighborhoods } from "@/constants/locations";

const C = Colors.dark;

type PickerModalProps = {
  visible: boolean;
  title: string;
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
  onClose: () => void;
};

function PickerModal({ visible, title, items, selected, onSelect, onClose }: PickerModalProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) =>
    i.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={15} color={C.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 400 }}
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.listItem,
                  isSelected && styles.listItemSelected,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(item);
                  setSearch("");
                  onClose();
                }}
              >
                <Text style={[styles.listItemText, isSelected && styles.listItemTextSelected]}>
                  {item}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyItem}>
              <Text style={styles.emptyItemText}>Nenhum resultado</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

type LocationPickerProps = {
  city: string;
  neighborhood: string;
  onCityChange: (city: string) => void;
  onNeighborhoodChange: (neighborhood: string) => void;
};

export default function LocationPicker({
  city,
  neighborhood,
  onCityChange,
  onNeighborhoodChange,
}: LocationPickerProps) {
  const [cityModal, setCityModal] = useState(false);
  const [neighborhoodModal, setNeighborhoodModal] = useState(false);

  const neighborhoods = getNeighborhoods(city);

  const handleCitySelect = (newCity: string) => {
    onCityChange(newCity);
    if (city !== newCity) onNeighborhoodChange("");
  };

  return (
    <View style={styles.container}>
      {/* City picker */}
      <View style={styles.fieldWrapper}>
        <View style={styles.fieldHeader}>
          <Feather name="map-pin" size={13} color={C.textTertiary} />
          <Text style={styles.fieldLabel}>Cidade</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.picker, pressed && { opacity: 0.8 }]}
          onPress={() => setCityModal(true)}
        >
          <Text style={city ? styles.pickerValue : styles.pickerPlaceholder}>
            {city || "Selecionar cidade..."}
          </Text>
          <Feather name="chevron-down" size={16} color={C.textTertiary} />
        </Pressable>
      </View>

      {/* Neighborhood picker */}
      <View style={styles.fieldWrapper}>
        <View style={styles.fieldHeader}>
          <Feather name="navigation" size={13} color={city ? C.textTertiary : C.textMuted} />
          <Text style={[styles.fieldLabel, !city && { color: C.textMuted }]}>Bairro</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.picker,
            !city && styles.pickerDisabled,
            pressed && city && { opacity: 0.8 },
          ]}
          onPress={() => city && setNeighborhoodModal(true)}
          disabled={!city}
        >
          <Text style={neighborhood ? styles.pickerValue : (!city ? styles.pickerDisabledText : styles.pickerPlaceholder)}>
            {neighborhood || (city ? "Selecionar bairro..." : "Escolha a cidade primeiro")}
          </Text>
          <Feather name="chevron-down" size={16} color={city ? C.textTertiary : C.textMuted} />
        </Pressable>
      </View>

      <PickerModal
        visible={cityModal}
        title="Selecionar Cidade"
        items={ALL_CITY_NAMES}
        selected={city}
        onSelect={handleCitySelect}
        onClose={() => setCityModal(false)}
      />

      <PickerModal
        visible={neighborhoodModal}
        title={`Bairros em ${city}`}
        items={neighborhoods}
        selected={neighborhood}
        onSelect={onNeighborhoodChange}
        onClose={() => setNeighborhoodModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  fieldWrapper: {
    gap: 8,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerDisabled: {
    borderColor: C.border,
    backgroundColor: C.backgroundSecondary,
  },
  pickerValue: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: C.text,
    flex: 1,
  },
  pickerPlaceholder: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    flex: 1,
  },
  pickerDisabledText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    flex: 1,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
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
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  listItemSelected: {
    backgroundColor: C.primaryGlow,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: -4,
    borderBottomWidth: 0,
  },
  listItemText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  listItemTextSelected: {
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  emptyItem: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyItemText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
});
