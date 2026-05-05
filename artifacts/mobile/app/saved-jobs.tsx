import { router, Stack } from "expo-router";
import React from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { JobCard } from "@/components/cards";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useI18n } from "@/lib/i18n";
import { useSavedJobs } from "@/lib/queries";

export default function SavedJobsScreen() {
  const c = useColors();
  const { t } = useI18n();
  const list = useSavedJobs();

  return (
    <>
      <Stack.Screen options={{ title: t("savedJobs") }} />
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
            ListEmptyComponent={
              <EmptyState title={t("noSavedJobs")} icon="bookmark-outline" />
            }
            refreshControl={
              <RefreshControl
                refreshing={list.isFetching && !list.isLoading}
                onRefresh={() => void list.refetch()}
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
    </>
  );
}
