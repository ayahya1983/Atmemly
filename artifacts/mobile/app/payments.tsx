import { Stack } from "expo-router";
import React from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { usePayments } from "@/lib/queries";

export default function PaymentsScreen() {
  const c = useColors();
  const { t, lang, isRTL } = useI18n();
  const list = usePayments();

  const total = (list.data ?? [])
    .filter((p) => p.status === "completed" || p.status === "succeeded")
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: t("payments") }} />
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
              gap: 12,
            }}
            ListHeaderComponent={
              <Card style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {t("totalEarnings")}
                </Text>
                <Text
                  style={{
                    color: c.primary,
                    fontFamily: "Inter_700Bold",
                    fontSize: 28,
                    marginTop: 6,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {formatCurrency(total, lang)}
                </Text>
              </Card>
            }
            ListEmptyComponent={
              <EmptyState title={t("emptyTitle")} icon="card-outline" />
            }
            refreshControl={
              <RefreshControl
                refreshing={list.isFetching && !list.isLoading}
                onRefresh={() => void list.refetch()}
                tintColor={c.primary}
              />
            }
            renderItem={({ item }) => {
              const tone =
                item.status === "completed" || item.status === "succeeded"
                  ? "success"
                  : item.status === "pending"
                  ? "warning"
                  : "danger";
              return (
                <Card>
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: c.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 14,
                          textAlign: isRTL ? "right" : "left",
                        }}
                      >
                        {item.jobTitle ?? `#${item.id}`}
                      </Text>
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontSize: 12,
                          fontFamily: "Inter_400Regular",
                          marginTop: 2,
                          textAlign: isRTL ? "right" : "left",
                        }}
                      >
                        {formatDate(item.createdAt, lang)}
                      </Text>
                    </View>
                    <View style={{ alignItems: isRTL ? "flex-start" : "flex-end", gap: 4 }}>
                      <Text
                        style={{
                          color: c.foreground,
                          fontFamily: "Inter_700Bold",
                          fontSize: 15,
                        }}
                      >
                        {formatCurrency(item.amount, lang, item.currency ?? "AED")}
                      </Text>
                      <Badge label={item.status} tone={tone} />
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>
    </>
  );
}
