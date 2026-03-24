import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isProvider = message.senderId === "provider";
  const time = new Date(message.timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View
      style={[
        styles.bubbleWrapper,
        isProvider ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isProvider ? styles.bubbleProvider : styles.bubbleClient,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isProvider ? styles.bubbleTextProvider : styles.bubbleTextClient,
          ]}
        >
          {message.text}
        </Text>
        <Text
          style={[
            styles.bubbleTime,
            isProvider ? styles.bubbleTimeProvider : styles.bubbleTimeClient,
          ]}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { services, sendMessage, provider } = useApp();
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const service = services.find((s) => s.id === id);
  const messages = service?.chatMessages ?? [];

  const handleSend = async () => {
    if (!text.trim() || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = text.trim();
    setText("");
    await sendMessage(id, msg, "provider");
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {service && (
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceInfoTitle} numberOfLines={1}>
            {service.title}
          </Text>
          <Text style={styles.serviceInfoSubtitle}>
            {service.city} • {service.neighborhood}
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Feather name="message-circle" size={48} color={C.textMuted} />
            <Text style={styles.emptyChatTitle}>Inicie a conversa</Text>
            <Text style={styles.emptyChatSubtitle}>
              Combine os detalhes do serviço com o cliente
            </Text>
          </View>
        }
        renderItem={({ item }) => <MessageBubble message={item} />}
        showsVerticalScrollIndicator={false}
      />

      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
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
            styles.sendButton,
            !text.trim() && styles.sendButtonDisabled,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={18} color={text.trim() ? "#000" : C.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  serviceInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  serviceInfoTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  serviceInfoSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 2,
  },
  bubbleWrapper: {
    maxWidth: "78%",
  },
  bubbleWrapperLeft: {
    alignSelf: "flex-start",
  },
  bubbleWrapperRight: {
    alignSelf: "flex-end",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleProvider: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleClient: {
    backgroundColor: C.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  bubbleTextProvider: {
    color: "#000",
  },
  bubbleTextClient: {
    color: C.text,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  bubbleTimeProvider: {
    color: "rgba(0,0,0,0.5)",
    textAlign: "right",
  },
  bubbleTimeClient: {
    color: C.textMuted,
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 60,
  },
  emptyChatTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  emptyChatSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: C.backgroundTertiary,
    borderWidth: 1,
    borderColor: C.border,
  },
});
