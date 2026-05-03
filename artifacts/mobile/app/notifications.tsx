import { Stack } from "expo-router";
import React from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { NotificationItem } from "@/components/cards";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useI18n } from "@/lib/i18n";
import { useMarkAllRead, useNotifications } from "@/lib/queries";

export default function NotificationsScreen() {
  const c = useColors();
  const { t } = useI18n();
  const list = useNotifications();
  const markAll = useMarkAllRead();

  return (
    <>
      <Stack.Screen
        options={{
          title: t("notifications"),
          headerRight: () => (
            <Button
              label={t("markAllRead")}
              variant="ghost"
              fullWidth={false}
              size="sm"
              onPress={() => markAll.mutate()}
            />
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : (
          <FlatList
            data={list.data ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{
              padding: 20,
              paddingBottom: 24,
              gap: 10,
            }}
            ListEmptyComponent={
              <EmptyState title={t("emptyTitle")} icon="notifications-outline" />
            }
            refreshControl={
              <RefreshControl
                refreshing={list.isFetching && !list.isLoading}
                onRefresh={() => void list.refetch()}
                tintColor={c.primary}
              />
            }
            renderItem={({ item }) => <NotificationItem n={item} />}
          />
        )}
      </View>
    </>
  );
}
