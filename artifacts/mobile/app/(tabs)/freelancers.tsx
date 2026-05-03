import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FreelancerCard } from "@/components/cards";
import {
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useI18n } from "@/lib/i18n";
import { useFreelancers } from "@/lib/queries";

export default function FreelancersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const [q, setQ] = useState("");
  const list = useFreelancers({ q: q || undefined });

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
          {t("freelancers")}
        </Text>
        <Input
          icon="search-outline"
          placeholder={t("search")}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
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
            gap: 12,
          }}
          ListEmptyComponent={
            <EmptyState title={t("emptyTitle")} icon="people-outline" />
          }
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching && !list.isLoading}
              onRefresh={() => void list.refetch()}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <FreelancerCard
              freelancer={item}
              onPress={() => router.push(`/freelancers/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
