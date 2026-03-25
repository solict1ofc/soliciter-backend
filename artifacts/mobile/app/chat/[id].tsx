import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { ChatMessage, ServiceStatus } from "@/context/AppContext";

const C = Colors.dark;

// Chat only unlocks after provider accepts
const CHAT_ALLOWED: ServiceStatus[] = ["accepted", "in_progress", "completed", "rated"];

// Status display for chat header
const STATUS_LABEL: Partial<Record<ServiceStatus, { label: string; color: string }>> = {
  accepted:    { label: "Aguardando início",      color: C.accent },
  in_progress: { label: "Em andamento",           color: C.warning },
  completed:   { label: "Aguardando confirmação", color: C.primary },
  rated:       { label: "Serviço concluído",      color: C.success },
};

// ─── Avatar initial ────────────────────────────────────────────────────────────
function Avatar({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color + "22", borderColor: color }]}>
      <Text style={[styles.avatarText, { color }]}>{label[0].toUpperCase()}</Text>
    </View>
  );
}

// ─── Date separator ───────────────────────────────────────────────────────────
function DateSeparator({ date }: { date: string }) {
  return (
    <View style={styles.dateSep}>
      <View style={styles.dateSepLine} />
      <Text style={styles.dateSepText}>{date}</Text>
      <View style={styles.dateSepLine} />
    </View>
  );
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ─── Message bubble ───────────────────────────────────────────────────────────
type BubbleProps = {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  showTime: boolean;
  otherName: string;
  otherColor: string;
};

function MessageBubble({ message, isOwn, showAvatar, showTime, otherName, otherColor }: BubbleProps) {
  const time = new Date(message.timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      {/* Avatar placeholder (left side only) */}
      {!isOwn && (
        <View style={styles.avatarSlot}>
          {showAvatar ? (
            <Avatar label={otherName} color={otherColor} />
          ) : (
            <View style={styles.avatarGap} />
          )}
        </View>
      )}

      <View style={styles.bubbleContainer}>
        {/* Sender label on first in group */}
        {!isOwn && showAvatar && (
          <Text style={[styles.senderLabel, { color: otherColor }]}>{otherName}</Text>
        )}

        <View style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
        ]}>
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            {message.text}
          </Text>

          {showTime && (
            <View style={styles.timeLine}>
              <Text style={[styles.timeText, isOwn ? styles.timeOwn : styles.timeOther]}>
                {time}
              </Text>
              {isOwn && (
                <Ionicons name="checkmark-done" size={12} color={isOwn ? "rgba(0,0,0,0.4)" : C.textMuted} />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { id, role: roleParam } = useLocalSearchParams<{ id: string; role?: string }>();
  const role = (roleParam === "client" ? "client" : "provider") as "client" | "provider";
  const insets = useSafeAreaInsets();
  const { services, provider, sendMessage, markChatRead } = useApp();
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const service = services.find((s) => s.id === id);
  const messages = service?.chatMessages ?? [];
  const chatAllowed = service ? CHAT_ALLOWED.includes(service.status) : false;

  // Role display names and colors
  const myName = role === "client" ? "Você (Cliente)" : "Você (Prestador)";
  const otherName = role === "client" ? provider.name : "Cliente";
  const otherColor = role === "client" ? C.accent : C.primary;
  const mySenderId = role; // "client" or "provider"

  // Mark messages as read when screen opens
  useEffect(() => {
    if (service && chatAllowed) {
      markChatRead(service.id, role);
    }
  }, [service?.id, chatAllowed]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !id || !chatAllowed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = text.trim();
    setText("");
    await sendMessage(id, msg, mySenderId);
  }, [text, id, chatAllowed, mySenderId, sendMessage]);

  // Build list items with date separators
  type ListItem =
    | { type: "date"; key: string; date: string }
    | { type: "msg"; key: string; message: ChatMessage; isOwn: boolean; showAvatar: boolean; showTime: boolean };

  const listItems: ListItem[] = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    // Date separator
    if (!prev || !isSameDay(prev.timestamp, msg.timestamp)) {
      listItems.push({ type: "date", key: `date_${i}`, date: formatDateLabel(msg.timestamp) });
    }
    const isOwn = msg.senderId === mySenderId;
    const nextIsSameSender = next && next.senderId === msg.senderId && isSameDay(msg.timestamp, next.timestamp);
    const prevIsSameSender = prev && prev.senderId === msg.senderId && isSameDay(prev.timestamp, msg.timestamp);

    listItems.push({
      type: "msg",
      key: msg.id,
      message: msg,
      isOwn,
      showAvatar: !isOwn && !prevIsSameSender, // show avatar on first of a group
      showTime: !nextIsSameSender,              // show time on last of a group
    });
  });

  // ── Blocked: service not found ─────────────────────────────────────────────
  if (!service) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={52} color={C.textMuted} />
        <Text style={styles.blockedTitle}>Serviço não encontrado</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={16} color={C.primary} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  // ── Blocked: chat not yet available ───────────────────────────────────────
  if (!chatAllowed) {
    const isPendingPayment = service.status === "pending_payment";
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtnSmall} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.topBarTitle} numberOfLines={1}>{service.title}</Text>
            <Text style={styles.topBarSub}>{service.city} • {service.neighborhood}</Text>
          </View>
        </View>

        <View style={styles.centered}>
          <View style={styles.lockedIconWrap}>
            <Ionicons name="lock-closed" size={42} color={C.warning} />
          </View>
          <Text style={styles.blockedTitle}>Chat Bloqueado</Text>
          <Text style={styles.blockedDesc}>
            {isPendingPayment
              ? "Conclua o pagamento para publicar a solicitação e aguardar um prestador."
              : "O chat só fica disponível depois que um prestador aceitar o serviço.\n\nIsso protege sua negociação e garante que o pagamento passe pela plataforma."
            }
          </Text>

          <View style={styles.statusSteps}>
            {[
              {
                label: isPendingPayment ? "Aguardando pagamento" : "Serviço criado e pago",
                done: !isPendingPayment,
                active: isPendingPayment,
              },
              {
                label: "Aguardando prestador aceitar",
                done: false,
                active: !isPendingPayment,
              },
              {
                label: "Chat liberado automaticamente",
                done: false,
                active: false,
              },
            ].map((step, i) => (
              <View key={i} style={styles.statusStep}>
                <View style={[
                  styles.statusDot,
                  step.done && styles.statusDotDone,
                  step.active && styles.statusDotActive,
                ]}>
                  {step.done
                    ? <Ionicons name="checkmark" size={12} color="#000" />
                    : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: step.active ? C.primary : C.textMuted }} />
                  }
                </View>
                <Text style={[
                  styles.statusStepText,
                  step.done && { color: C.success, fontFamily: "Inter_500Medium" },
                  step.active && { color: C.primary, fontFamily: "Inter_600SemiBold" },
                ]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={16} color={C.primary} />
            <Text style={styles.backBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Active chat ───────────────────────────────────────────────────────────
  const statusInfo = STATUS_LABEL[service.status];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtnSmall} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Avatar label={otherName} color={otherColor} />
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle} numberOfLines={1}>{otherName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={[styles.onlineDot, { backgroundColor: statusInfo?.color ?? C.success }]} />
            <Text style={[styles.topBarSub, statusInfo && { color: statusInfo.color }]}>
              {statusInfo?.label ?? "Chat ativo"}
            </Text>
          </View>
        </View>
        <View style={styles.secureBadge}>
          <Ionicons name="shield-checkmark" size={11} color={C.success} />
          <Text style={styles.secureBadgeText}>Seguro</Text>
        </View>
      </View>

      {/* Notice bar */}
      <View style={styles.noticeBar}>
        <Ionicons name="information-circle-outline" size={13} color={C.textSecondary} />
        <Text style={styles.noticeText}>
          Combine os detalhes. Pagamentos só pela plataforma SOLICITE.
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={listItems}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyChatIcon}>
              <Ionicons name="chatbubbles-outline" size={52} color={C.textMuted} />
            </View>
            <Text style={styles.emptyChatTitle}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptyChatSub}>
              {role === "provider"
                ? "Apresente-se e combine os detalhes com o cliente"
                : "Pergunte ao prestador detalhes sobre o serviço"
              }
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === "date") {
            return <DateSeparator date={item.date} />;
          }
          return (
            <MessageBubble
              message={item.message}
              isOwn={item.isOwn}
              showAvatar={item.showAvatar}
              showTime={item.showTime}
              otherName={otherName}
              otherColor={otherColor}
            />
          );
        }}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Mensagem..."
          placeholderTextColor={C.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          onSubmitEditing={Platform.OS !== "ios" ? handleSend : undefined}
          returnKeyType="send"
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            !text.trim() && styles.sendBtnDisabled,
            pressed && text.trim() && { opacity: 0.75, transform: [{ scale: 0.95 }] },
          ]}
          onPress={handleSend}
          disabled={!text.trim()}
          hitSlop={6}
        >
          <Ionicons
            name="send"
            size={18}
            color={text.trim() ? "#000" : C.textMuted}
            style={{ marginLeft: 2 }}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 20 },

  // ── Header
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtnSmall: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center",
  },
  topBarTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  topBarSub: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  secureBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.successLight, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: C.success,
  },
  secureBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.success },

  // ── Avatar
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  // ── Notice
  noticeBar: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: "#1A1A2E", borderBottomWidth: 1, borderBottomColor: C.border,
  },
  noticeText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, flex: 1 },

  // ── Message list
  messageList: { padding: 12, paddingBottom: 24, flexGrow: 1, gap: 2 },

  // ── Date separator
  dateSep: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 },
  dateSepLine: { flex: 1, height: 1, backgroundColor: C.border },
  dateSepText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textMuted },

  // ── Bubble
  bubbleRow: { flexDirection: "row", marginVertical: 1, maxWidth: "85%" },
  bubbleRowLeft: { alignSelf: "flex-start", alignItems: "flex-end" },
  bubbleRowRight: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  avatarSlot: { width: 36, marginRight: 6 },
  avatarGap: { width: 36 },
  bubbleContainer: { flex: 1, gap: 2 },
  senderLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 2, marginLeft: 2 },
  bubble: {
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9,
    maxWidth: "100%",
  },
  bubbleOwn: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
    alignSelf: "flex-end",
  },
  bubbleOther: {
    backgroundColor: C.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: C.border,
    alignSelf: "flex-start",
  },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  bubbleTextOwn: { color: "#000" },
  bubbleTextOther: { color: C.text },
  timeLine: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3, justifyContent: "flex-end" },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  timeOwn: { color: "rgba(0,0,0,0.45)" },
  timeOther: { color: C.textMuted },

  // ── Empty state
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyChatIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  emptyChatTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  emptyChatSub: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary,
    textAlign: "center", lineHeight: 22, paddingHorizontal: 24,
  },

  // ── Input bar
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  textInput: {
    flex: 1, backgroundColor: C.backgroundTertiary, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
    borderWidth: 1, borderColor: C.border, maxHeight: 120,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.backgroundTertiary, borderWidth: 1, borderColor: C.border },

  // ── Blocked state
  lockedIconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: C.warningLight, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.warning,
  },
  blockedTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  blockedDesc: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary,
    textAlign: "center", lineHeight: 22,
  },
  statusSteps: { gap: 14, width: "100%", paddingHorizontal: 8, marginTop: 4 },
  statusStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.backgroundTertiary, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  statusDotDone: { backgroundColor: C.success, borderColor: C.success },
  statusDotActive: { borderColor: C.primary, borderWidth: 2 },
  statusStepText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted, flex: 1 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary,
    marginTop: 8,
  },
  backBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary },
});
