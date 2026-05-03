import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JobCard } from "@/components/cards";
import {
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useI18n } from "@/lib/i18n";
import { useJobs } from "@/lib/queries";

export default function JobsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const params = useLocalSearchParams<{ category?: string }>();
  const [q, setQ] = useState("");
  const jobs = useJobs({
    q: q || undefined,
    category: params.category || undefined,
  });

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
          {t("jobs")}
        </Text>
        <Input
          icon="search-outline"
          placeholder={t("search")}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
      </View>
      {jobs.isLoading ? (
        <LoadingState />
      ) : jobs.isError ? (
        <ErrorState onRetry={() => void jobs.refetch()} />
      ) : (
        <FlatList
          data={jobs.data ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
            gap: 12,
          }}
          ListEmptyComponent={
            <EmptyState title={t("emptyTitle")} icon="briefcase-outline" />
          }
          refreshControl={
            <RefreshControl
              refreshing={jobs.isFetching && !jobs.isLoading}
              onRefresh={() => void jobs.refetch()}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPress={() => router.push(`/jobs/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
