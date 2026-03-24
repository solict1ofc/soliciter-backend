import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet, Image } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppContextProvider, useApp } from "@/context/AppContext";
import { AuthContextProvider, useAuth } from "@/context/AuthContext";
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

// ── Auth navigation guard ──────────────────────────────────────────────────────
function AuthGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  return null;
}

function RootLayoutNav() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={splash.container}>
        <View style={splash.ring1} />
        <View style={splash.ring2} />
        <View style={splash.logoBox}>
          <Image
            source={require("../assets/images/logo.jpeg")}
            style={splash.logoImage}
            resizeMode="cover"
          />
        </View>
        <Text style={splash.brand}>SOLICITE</Text>
        <Text style={splash.tagline}>Serviços sob demanda</Text>
        <View style={splash.loadingBar}>
          <View style={splash.loadingFill} />
        </View>
        <Text style={splash.loadingText}>Verificando sessão...</Text>
      </View>
    );
  }

  return (
    <AppContextProvider>
      <NotificationProvider>
        <NotificationWatcher />
        <GestureHandlerRootView>
          <KeyboardProvider>
            <Stack screenOptions={{ headerBackTitle: "Voltar" }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
              <Stack.Screen
                name="provider-register"
                options={{ headerShown: false, presentation: "card" }}
              />
            </Stack>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </NotificationProvider>
    </AppContextProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={splash.container}>
        <View style={splash.ring1} />
        <View style={splash.ring2} />
        <View style={splash.logoBox}>
          <Image
            source={require("../assets/images/logo.jpeg")}
            style={splash.logoImage}
            resizeMode="cover"
          />
        </View>
        <Text style={splash.brand}>SOLICITE</Text>
        <Text style={splash.tagline}>Serviços sob demanda</Text>
        <View style={splash.loadingBar}>
          <View style={splash.loadingFill} />
        </View>
        <Text style={splash.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthContextProvider>
            <AuthGuard />
            <RootLayoutNav />
          </AuthContextProvider>
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
    gap: 20,
  },
  ring1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.15)",
    backgroundColor: "transparent",
  },
  ring2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.25)",
    backgroundColor: "transparent",
  },
  logoBox: {
    width: 180,
    height: 180,
    borderRadius: 48,
    backgroundColor: "#00D4FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#00D4FF",
    shadowOpacity: 0.65,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    borderWidth: 3,
    borderColor: "rgba(0,212,255,0.5)",
  },
  logoImage: { width: 180, height: 180 },
  brand: { fontSize: 40, fontWeight: "800", color: "#FFFFFF", letterSpacing: 6, marginTop: 4 },
  tagline: { fontSize: 15, color: "#A0A0B8", letterSpacing: 1 },
  loadingBar: {
    width: 160,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  loadingFill: { width: "60%", height: "100%", backgroundColor: "#00D4FF", borderRadius: 2 },
  loadingText: { fontSize: 12, color: "rgba(160,160,184,0.6)", letterSpacing: 1 },
});
