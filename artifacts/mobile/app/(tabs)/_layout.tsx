import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const C = Colors.dark;

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { default: IoniconsName; focused: IoniconsName }> = {
  index:    { default: "add-circle",  focused: "add-circle" },
  global:   { default: "globe",       focused: "globe" },
  provider: { default: "briefcase",   focused: "briefcase" },
  profile:  { default: "person",      focused: "person" },
};

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textSecondary,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : C.tabBar,
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 0,
          height: 56 + safeAreaInsets.bottom,
          paddingBottom: safeAreaInsets.bottom,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.tabBar }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
        tabBarIcon: ({ color, focused }) => {
          const icons = TAB_ICONS[route.name];
          if (!icons) return null;
          return (
            <Ionicons
              name={focused ? icons.focused : icons.default}
              size={24}
              color={color}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="index"    options={{ title: "Solicitar" }} />
      <Tabs.Screen name="global"   options={{ title: "Global" }} />
      <Tabs.Screen name="provider" options={{ title: "Prestador" }} />
      <Tabs.Screen name="profile"  options={{ title: "Perfil" }} />
    </Tabs>
  );
}
