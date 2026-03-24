import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, { box: number; icon: number; hand: number; brand: number; radius: number; gap: number }> = {
  xs: { box: 28, icon: 14, hand: 10, brand: 12, radius: 8,  gap: 6  },
  sm: { box: 38, icon: 19, hand: 13, brand: 17, radius: 11, gap: 9  },
  md: { box: 56, icon: 28, hand: 18, brand: 24, radius: 16, gap: 12 },
  lg: { box: 88, icon: 44, hand: 28, brand: 38, radius: 24, gap: 18 },
};

type Props = {
  size?: Size;
  showText?: boolean;
};

export function SoliciteLogo({ size = "sm", showText = true }: Props) {
  const s = SIZES[size];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s.gap }}>
      {/* ── Logo mark ── */}
      <View
        style={{
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
          backgroundColor: C.primary,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          shadowColor: C.primary,
          shadowOpacity: 0.5,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      >
        {/* Purple diagonal accent overlay */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: s.box * 0.55,
            height: s.box * 0.55,
            borderRadius: s.radius * 0.6,
            backgroundColor: C.accent,
            opacity: 0.45,
            transform: [{ rotate: "25deg" }],
          }}
        />
        {/* Handshake: two small hands */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 1, zIndex: 1 }}>
          <Ionicons name="hand-right" size={s.hand} color="#0A0A0F" />
          <Ionicons name="hand-left"  size={s.hand} color="#0A0A0F" />
        </View>
      </View>

      {/* ── Brand text ── */}
      {showText && (
        <Text
          style={{
            fontSize: s.brand,
            fontFamily: "Inter_700Bold",
            color: C.text,
            letterSpacing: 2.5,
          }}
        >
          SOLICITE
        </Text>
      )}
    </View>
  );
}

export default SoliciteLogo;
