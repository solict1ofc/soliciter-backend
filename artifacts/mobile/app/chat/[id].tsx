import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
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
import type { ChatMessage } from "@/context/AppContext";

const C = Colors.dark;

// Chat is only available after the provider has accepted (status ≥ accepted)
const CHAT_ALLOWED_STATUSES = ["accepted", "in_progress", "completed", "rated"];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isProvider = message.senderId === "provider";
  const time = new Date(message.timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View style={[styles.bubbleWrapper, isProvider ? styles.right : styles.left]}>
      <View style={[styles.bubble, isProvider ? styles.bubbleProvider : styles.bubbleClient]}>
        <Text style={[styles.bubbleText, isProvider ? styles.textProvider : styles.textClient]}>
          {message.text}
        </Text>
        <Text style={[styles.bubbleTime, isProvider ? styles.timeProvider : styles.timeClient]}>
          {time}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { services, sendMessage } = useApp();
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const service = services.find((s) => s.id === id);
  const messages = service?.chatMessages ?? [];
  const chatAllowed = service ? CHAT_ALLOWED_STATUSES.includes(service.status) : false;

  const handleSend = async () => {
    if (!text.trim() || !id || !chatAllowed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = text.trim();
    setText("");
    await sendMessage(id, msg, "provider");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Blocked state ─────────────────────────────────────────────────────────
  if (!service) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={48} color={C.textMuted} />
        <Text style={styles.blockedTitle}>Serviço não encontrado</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={16} color={C.primary} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  if (!chatAllowed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtnSmall} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>{service.title}</Text>
        </View>
        <View style={styles.centered}>
          <View style={styles.blockedIconWrap}>
            <Ionicons name="lock-closed" size={40} color={C.warning} />
          </View>
          <Text style={styles.blockedTitle}>Chat Bloqueado</Text>
          <Text style={styles.blockedDesc}>
            O chat só fica disponível depois que um prestador aceitar o serviço.
            {"\n\n"}Isso protege a plataforma e garante que a negociação aconteça de forma segura.
          </Text>
          <View style={styles.statusSteps}>
            {[
              { label: "Serviço criado e pago", done: true },
              { label: "Aguardando prestador aceitar", done: false, active: true },
              { label: "Chat liberado automaticamente", done: false },
            ].map((step, i) => (
              <View key={i} style={styles.statusStep}>
                <View style={[
                  styles.statusStepDot,
                  step.done && styles.statusStepDotDone,
                  step.active && styles.statusStepDotActive,
                ]}>
                  {step.done ? (
                    <Ionicons name="checkmark" size={12} color="#000" />
                  ) : (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: step.active ? C.primary : C.textMuted }} />
                  )}
                </View>
                <Text style={[
                  styles.statusStepText,
                  step.done && { color: C.success },
                  step.active && { color: C.primary, fontFamily: "Inter_600SemiBold" },
                ]}>{step.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Active chat ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtnSmall} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle} numberOfLines={1}>{service.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={styles.onlineDot} />
            <Text style={styles.topBarSub}>Chat ativo • {service.city}</Text>
          </View>
        </View>
        <View style={styles.chatSecureBadge}>
          <Ionicons name="shield-checkmark" size={12} color={C.success} />
          <Text style={styles.chatSecureText}>Seguro</Text>
        </View>
      </View>

      <View style={styles.chatNotice}>
        <Ionicons name="information-circle-outline" size={14} color={C.textSecondary} />
        <Text style={styles.chatNoticeText}>
          Combine detalhes do serviço aqui. Pagamentos só pela plataforma.
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 16, flexGrow: 1 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={52} color={C.textMuted} />
            <Text style={styles.emptyChatTitle}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptyChatSub}>Combine os detalhes do serviço com o cliente</Text>
          </View>
        }
        renderItem={({ item }) => <MessageBubble message={item} />}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Mensagem..."
          placeholderTextColor={C.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            !text.trim() && styles.sendBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSend}
          disabled={!text.trim()}
          hitSlop={6}
        >
          <Ionicons name="send" size={18} color={text.trim() ? "#000" : C.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },

  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtnSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center",
  },
  topBarTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  topBarSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success },
  chatSecureBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.successLight, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.success,
  },
  chatSecureText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.success },

  chatNotice: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.backgroundTertiary, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  chatNoticeText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, flex: 1 },

  // Blocked state
  blockedIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.warningLight, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.warning,
  },
  blockedTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  blockedDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 22 },
  statusSteps: { gap: 12, width: "100%", paddingHorizontal: 16 },
  statusStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusStepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.backgroundTertiary, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  statusStepDotDone: { backgroundColor: C.success, borderColor: C.success },
  statusStepDotActive: { borderColor: C.primary, borderWidth: 2 },
  statusStepText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted, flex: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.primary },
  backBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary },

  // Messages
  bubbleWrapper: { maxWidth: "78%" },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, gap: 4 },
  bubbleProvider: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleClient: { backgroundColor: C.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  textProvider: { color: "#000" },
  textClient: { color: C.text },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  timeProvider: { color: "rgba(0,0,0,0.5)", textAlign: "right" },
  timeClient: { color: C.textMuted },

  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  emptyChatTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  emptyChatSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 22, paddingHorizontal: 24 },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  textInput: {
    flex: 1, backgroundColor: C.backgroundTertiary, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
    borderWidth: 1, borderColor: C.border, maxHeight: 120,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.backgroundTertiary, borderWidth: 1, borderColor: C.border },
});
