import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as ExpoNotifications from "expo-notifications";
import { router } from "expo-router";

import Colors from "@/constants/colors";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppNotifType =
  | "nova_solicitacao"    // new service → /(tabs)/global
  | "servico_aceito"      // service accepted → /chat/:id?role=client
  | "servico_iniciado"    // service started → /(tabs)/
  | "servico_concluido"   // service completed → /(tabs)/
  | "pagamento"           // payment confirmed → /(tabs)/
  | "mensagem_cliente"    // message from client → /chat/:id?role=provider
  | "mensagem_prestador"  // message from provider → /chat/:id?role=client
  | "saque"               // withdrawal → /(tabs)/profile
  | "info";               // generic (no navigation)

export type NotifData = {
  type: AppNotifType;
  serviceId?: string;
  href?: string;          // pre-computed route, overrides default
};

type VisualType = "success" | "info" | "warning" | "error";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: VisualType;
  urgent: boolean;
  data?: NotifData;
};

type NotifContextValue = {
  notify: (
    title: string,
    body: string,
    type?: VisualType,
    urgent?: boolean,
    data?: NotifData
  ) => void;
  scheduleLocalNotification: (
    title: string,
    body: string,
    data?: NotifData
  ) => Promise<void>;
};

// ─── Route resolver ───────────────────────────────────────────────────────────

export function resolveNotifRoute(data?: NotifData): string | null {
  if (!data) return null;
  if (data.href) return data.href;
  const { type, serviceId } = data;
  switch (type) {
    case "nova_solicitacao":   return "/(tabs)/global";
    case "servico_aceito":     return serviceId ? `/chat/${serviceId}?role=client`    : "/(tabs)/";
    case "servico_concluido":  return "/(tabs)/";
    case "servico_iniciado":   return "/(tabs)/";
    case "pagamento":          return "/(tabs)/";
    case "mensagem_cliente":   return serviceId ? `/chat/${serviceId}?role=provider`  : "/(tabs)/";
    case "mensagem_prestador": return serviceId ? `/chat/${serviceId}?role=client`    : "/(tabs)/";
    case "saque":              return "/(tabs)/profile";
    default:                   return null;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotifContext = createContext<NotifContextValue>({
  notify: () => {},
  scheduleLocalNotification: async () => {},
});

export function useNotify() {
  return useContext(NotifContext);
}

// ─── Visual config ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  VisualType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string }
> = {
  success: { icon: "checkmark-circle",  color: C.success, bg: C.successLight, border: C.success },
  info:    { icon: "information-circle", color: C.primary, bg: C.primaryGlow,  border: C.primary },
  warning: { icon: "warning",            color: C.warning, bg: C.warningLight, border: C.warning },
  error:   { icon: "close-circle",       color: C.danger,  bg: C.dangerLight,  border: C.danger },
};

// ─── Notification handler (foreground OS notifications → in-app toast) ────────
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,     // we handle sound ourselves
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Sound helper ─────────────────────────────────────────────────────────────

async function playNotifSound(urgent: boolean) {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const src = urgent
      ? require("../assets/sounds/urgent.wav")
      : require("../assets/sounds/notification.wav");
    const { sound } = await Audio.Sound.createAsync(src, { volume: urgent ? 1.0 : 0.75 });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
    await sound.playAsync();
  } catch {
    // sound is enhancement only — fail silently
  }
}

// ─── Haptics helper ───────────────────────────────────────────────────────────

async function triggerHaptics(urgent: boolean) {
  if (urgent) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
  } else {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

// ─── OS notification scheduling (for background state) ───────────────────────

async function scheduleOSNotification(
  title: string,
  body: string,
  data?: NotifData
): Promise<void> {
  if (Platform.OS === "web") return; // not supported on web
  try {
    await ExpoNotifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ? { ...data } : {},
        sound: true,
      },
      trigger: null, // deliver immediately
    });
  } catch {
    // gracefully skip if permissions not granted
  }
}

// ─── Toast component ──────────────────────────────────────────────────────────

function NotifToast({
  notif,
  onDismiss,
}: {
  notif: Notification;
  onDismiss: () => void;
}) {
  const cfg = TYPE_CONFIG[notif.type];
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const duration = notif.urgent ? 5500 : 3800;
  const route = resolveNotifRoute(notif.data);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 90,
        friction: 10,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    let glowLoop: Animated.CompositeAnimation | null = null;
    if (notif.urgent) {
      glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      );
      glowLoop.start();
    }

    const timer = setTimeout(() => {
      glowLoop?.stop();
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, duration);

    return () => {
      clearTimeout(timer);
      glowLoop?.stop();
    };
  }, []);

  const urgentBorderOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const handlePress = () => {
    onDismiss();
    if (route) {
      try {
        router.push(route as any);
      } catch {
        // navigation errors are non-fatal
      }
    }
  };

  return (
    <Pressable
      onPress={route ? handlePress : undefined}
      style={{ borderRadius: 16 }}
    >
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: cfg.bg, borderColor: cfg.border, transform: [{ translateY }], opacity },
          notif.urgent && styles.toastUrgent,
          route && styles.toastTappable,
        ]}
      >
        {notif.urgent && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.urgentGlowBorder, { opacity: urgentBorderOpacity }]}
            pointerEvents="none"
          />
        )}

        <View style={[styles.iconWrap, notif.urgent && styles.iconWrapUrgent]}>
          <Ionicons name={cfg.icon} size={notif.urgent ? 26 : 22} color={cfg.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.toastTitle, { color: cfg.color }]} numberOfLines={2}>
            {notif.title}
          </Text>
          <Text style={styles.toastBody} numberOfLines={2}>
            {notif.body}
          </Text>
          {route && (
            <Text style={[styles.tapHint, { color: cfg.color }]}>
              Toque para abrir →
            </Text>
          )}
        </View>

        {/* Dismiss: inner Pressable captures touch so outer nav Pressable is NOT triggered */}
        <Pressable onPress={onDismiss} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color={cfg.color} />
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Request OS notification permissions (native only)
  useEffect(() => {
    if (Platform.OS === "web") return;
    ExpoNotifications.requestPermissionsAsync().catch(() => {});
  }, []);

  // Handle tap on OS notification when app is in FOREGROUND
  // (background/killed is handled in _layout.tsx via response listener)
  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotifData | undefined;
      const route = resolveNotifRoute(data);
      if (route) {
        try {
          router.push(route as any);
        } catch {
          // navigation not ready yet — _layout.tsx cold-start handler will retry
        }
      }
    });

    return () => sub.remove();
  }, []);

  // Show in-app toast
  const notify = useCallback(
    (
      title: string,
      body: string,
      type: VisualType = "info",
      urgent: boolean = false,
      data?: NotifData
    ) => {
      const id = `notif_${Date.now()}_${Math.random()}`;
      setNotifications((prev) => [...prev.slice(-2), { id, title, body, type, urgent, data }]);
      triggerHaptics(urgent);
      playNotifSound(urgent);
    },
    []
  );

  // Schedule OS-level notification (appears even when app is background/killed)
  const scheduleLocalNotification = useCallback(
    async (title: string, body: string, data?: NotifData) => {
      await scheduleOSNotification(title, body, data);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotifContext.Provider value={{ notify, scheduleLocalNotification }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {notifications.map((n) => (
          <NotifToast key={n.id} notif={n} onDismiss={() => dismiss(n.id)} />
        ))}
      </View>
    </NotifContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 56,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
    overflow: "hidden",
  },
  toastTappable: {
    shadowColor: "#00D4FF",
    shadowOpacity: 0.25,
  },
  toastUrgent: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 2,
  },
  urgentGlowBorder: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.danger,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  iconWrapUrgent: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  toastTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  toastBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 17,
  },
  tapHint: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    opacity: 0.7,
    letterSpacing: 0.3,
  },
  closeBtn: {
    marginLeft: "auto" as any,
    padding: 4,
  },
});
