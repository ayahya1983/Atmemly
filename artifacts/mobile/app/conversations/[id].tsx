import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, Input, LoadingState } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useMessages, useSendMessage } from "@/lib/queries";

export default function ConversationScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const messages = useMessages(id);
  const send = useSendMessage(id ?? "");
  const [text, setText] = useState("");

  const onSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      await send.mutateAsync(body);
    } catch {
      setText(body);
    }
  };

  if (messages.isLoading) return <LoadingState />;
  if (messages.isError) return <ErrorState onRetry={() => void messages.refetch()} />;

  const data = [...(messages.data ?? [])].reverse();

  return (
    <>
      <Stack.Screen options={{ title: t("messages") }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior="padding"
        keyboardVerticalOffset={64}
      >
        <FlatList
          data={data}
          inverted
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          renderItem={({ item }) => {
            const mine = user && item.senderId === user.id;
            return (
              <View
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  backgroundColor: mine ? c.primary : c.surface,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 16,
                  borderTopLeftRadius: mine ? 16 : 4,
                  borderTopRightRadius: mine ? 4 : 16,
                  borderWidth: mine ? 0 : 1,
                  borderColor: c.border,
                }}
              >
                <Text
                  style={{
                    color: mine ? c.primaryForeground : c.foreground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {item.body}
                </Text>
                <Text
                  style={{
                    color: mine ? c.primaryForeground : c.mutedForeground,
                    opacity: 0.7,
                    fontSize: 10,
                    marginTop: 4,
                    fontFamily: "Inter_400Regular",
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {timeAgo(item.createdAt, lang)}
                </Text>
              </View>
            );
          }}
        />
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            gap: 8,
            padding: 12,
            paddingBottom: insets.bottom + 8,
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.background,
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Input
              placeholder={t("typeMessage")}
              value={text}
              onChangeText={setText}
              onSubmitEditing={onSend}
              returnKeyType="send"
            />
          </View>
          <Pressable
            onPress={onSend}
            disabled={!text.trim() || send.isPending}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: c.radius,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: !text.trim() || send.isPending ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <Ionicons
              name={isRTL ? "arrow-back" : "arrow-forward"}
              size={20}
              color={c.primaryForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
