import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppContextProvider, useApp } from "@/context/AppContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { useServiceNotifications } from "@/hooks/useNotifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Watches service status changes and fires in-app notifications
function NotificationWatcher() {
  const { services } = useApp();
  useServiceNotifications(services);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Voltar" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="provider-register"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Load all Ionicons font variants explicitly for Android
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={splash.container}>
        <View style={splash.logoBox}>
          <View style={splash.accentOverlay} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, zIndex: 1 }}>
            <Ionicons name="hand-right" size={38} color="#0A0A0F" />
            <Ionicons name="hand-left"  size={38} color="#0A0A0F" />
          </View>
        </View>
        <Text style={splash.brand}>SOLICITE</Text>
        <Text style={splash.tagline}>Serviços em Goiânia</Text>
        <ActivityIndicator color="#00D4FF" size="large" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppContextProvider>
            <NotificationProvider>
              <NotificationWatcher />
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </NotificationProvider>
          </AppContextProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 30,
    backgroundColor: "#00D4FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#00D4FF",
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  accentOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 65,
    height: 65,
    borderRadius: 18,
    backgroundColor: "#6C63FF",
    opacity: 0.4,
    transform: [{ rotate: "20deg" }],
  },
  brand: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 4,
    marginTop: 8,
  },
  tagline: {
    fontSize: 15,
    color: "#A0A0B8",
    letterSpacing: 0.5,
  },
});
