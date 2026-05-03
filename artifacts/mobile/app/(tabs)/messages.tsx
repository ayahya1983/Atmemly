import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConversationCard } from "@/components/cards";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useConversations } from "@/lib/queries";

export default function MessagesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const list = useConversations();

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          gap: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="lock-closed-outline" size={42} color={c.mutedForeground} />
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
          }}
        >
          {t("login")}
        </Text>
        <Button label={t("login")} onPress={() => router.push("/(auth)/login")} fullWidth={false} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 24,
            textAlign: isRTL ? "right" : "left",
            marginBottom: 12,
          }}
        >
          {t("messages")}
        </Text>
      </View>
      {list.isLoading ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={list.data ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
            gap: 10,
          }}
          ListEmptyComponent={
            <EmptyState
              title={t("noConversations")}
              icon="chatbubbles-outline"
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching && !list.isLoading}
              onRefresh={() => void list.refetch()}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <ConversationCard
              conv={item}
              onPress={() => router.push(`/conversations/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
