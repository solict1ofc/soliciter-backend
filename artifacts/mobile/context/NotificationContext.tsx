import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.dark;

type NotifType = "success" | "info" | "warning" | "error";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: NotifType;
};

type NotifContextValue = {
  notify: (title: string, body: string, type?: NotifType) => void;
};

const NotifContext = createContext<NotifContextValue>({ notify: () => {} });

export function useNotify() {
  return useContext(NotifContext);
}

const TYPE_CONFIG: Record<NotifType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string }> = {
  success: { icon: "checkmark-circle",  color: C.success, bg: C.successLight, border: C.success },
  info:    { icon: "information-circle", color: C.primary, bg: C.primaryGlow,  border: C.primary },
  warning: { icon: "warning",            color: C.warning, bg: C.warningLight, border: C.warning },
  error:   { icon: "close-circle",       color: C.danger,  bg: C.dangerLight,  border: C.danger },
};

function NotifToast({ notif, onDismiss }: { notif: Notification; onDismiss: () => void }) {
  const cfg = TYPE_CONFIG[notif.type];
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, 3800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.toast, { backgroundColor: cfg.bg, borderColor: cfg.border, transform: [{ translateY }], opacity }]}>
      <Ionicons name={cfg.icon} size={22} color={cfg.color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.toastTitle, { color: cfg.color }]}>{notif.title}</Text>
        <Text style={styles.toastBody}>{notif.body}</Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={10}>
        <Ionicons name="close" size={16} color={cfg.color} />
      </Pressable>
    </Animated.View>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((title: string, body: string, type: NotifType = "info") => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    setNotifications((prev) => [...prev.slice(-2), { id, title, body, type }]);
  }, []);

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
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  toastTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  toastBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 17,
  },
});
