import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

import Colors from "@/constants/colors";

const C = Colors.dark;

type NotifType = "success" | "info" | "warning" | "error";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  urgent: boolean;
};

type NotifContextValue = {
  notify: (title: string, body: string, type?: NotifType, urgent?: boolean) => void;
};

const NotifContext = createContext<NotifContextValue>({ notify: () => {} });

export function useNotify() {
  return useContext(NotifContext);
}

const TYPE_CONFIG: Record<
  NotifType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string }
> = {
  success: { icon: "checkmark-circle",  color: C.success, bg: C.successLight, border: C.success },
  info:    { icon: "information-circle", color: C.primary, bg: C.primaryGlow,  border: C.primary },
  warning: { icon: "warning",            color: C.warning, bg: C.warningLight, border: C.warning },
  error:   { icon: "close-circle",       color: C.danger,  bg: C.dangerLight,  border: C.danger },
};

// ─── Play notification sound ──────────────────────────────────────────────────
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
    // silently fail — sound is enhancement only
  }
}

// ─── Haptics vibration pattern ────────────────────────────────────────────────
async function triggerHaptics(urgent: boolean) {
  if (urgent) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
  } else {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
  const translateY = useRef(new Animated.Value(-110)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const duration = notif.urgent ? 5500 : 3800;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 90,
        friction: 10,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    // Urgent glow pulse
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

    // Auto-dismiss
    const timer = setTimeout(() => {
      glowLoop?.stop();
      Animated.parallel([
        Animated.timing(translateY, { toValue: -110, duration: 300, useNativeDriver: true }),
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

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: cfg.bg, borderColor: cfg.border, transform: [{ translateY }], opacity },
        notif.urgent && styles.toastUrgent,
      ]}
    >
      {/* Pulsing border overlay for urgent */}
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
      </View>

      <Pressable onPress={onDismiss} hitSlop={12}>
        <Ionicons name="close" size={16} color={cfg.color} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback(
    (title: string, body: string, type: NotifType = "info", urgent: boolean = false) => {
      const id = `notif_${Date.now()}_${Math.random()}`;
      setNotifications((prev) => [...prev.slice(-2), { id, title, body, type, urgent }]);
      triggerHaptics(urgent);
      playNotifSound(urgent);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotifContext.Provider value={{ notify }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {notifications.map((n) => (
          <NotifToast key={n.id} notif={n} onDismiss={() => dismiss(n.id)} />
        ))}
      </View>
    </NotifContext.Provider>
  );
}

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
});
