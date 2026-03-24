import React from "react";
import { View, Text, Image } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, { box: number; brand: number; radius: number; gap: number }> = {
  xs: { box: 28, brand: 12, radius: 8,  gap: 6  },
  sm: { box: 38, brand: 17, radius: 11, gap: 9  },
  md: { box: 56, brand: 24, radius: 16, gap: 12 },
  lg: { box: 88, brand: 38, radius: 24, gap: 18 },
};

type Props = {
  size?: Size;
  showText?: boolean;
};

export function SoliciteLogo({ size = "sm", showText = true }: Props) {
  const s = SIZES[size];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s.gap }}>
      <View
        style={{
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
          overflow: "hidden",
          shadowColor: C.primary,
          shadowOpacity: 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 6,
        }}
      >
        <Image
          source={require("@/assets/images/logo.jpeg")}
          style={{ width: s.box, height: s.box }}
          resizeMode="cover"
        />
      </View>

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
