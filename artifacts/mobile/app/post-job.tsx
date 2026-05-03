import { router, Stack } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Input } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useCategories, useCreateJob } from "@/lib/queries";

export default function PostJobScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useI18n();
  const cats = useCategories();
  const create = useCreateJob();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetType, setBudgetType] = useState<"fixed" | "hourly">("fixed");
  const [category, setCategory] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!title || !description) {
      setError(t("required"));
      return;
    }
    try {
      await create.mutateAsync({
        title,
        description,
        budgetType,
        budget: Number(budget) || undefined,
        category: category || undefined,
      });
      router.back();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("postJob") }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 24,
          gap: 14,
        }}
      >
        <Input label={t("jobTitle")} value={title} onChangeText={setTitle} />
        <Input
          label={t("jobDescription")}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          style={{ minHeight: 140, paddingVertical: 8 }}
        />
        <View>
          <Text
            style={{
              color: c.foreground,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              marginBottom: 8,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t("budgetType")}
          </Text>
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              gap: 10,
            }}
          >
            {(["fixed", "hourly"] as const).map((bt) => {
              const active = budgetType === bt;
              return (
                <Pressable
                  key={bt}
                  onPress={() => setBudgetType(bt)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: c.radius,
                    borderWidth: 1,
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.accent : c.surface,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? c.primary : c.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    {t(bt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Input
          label={t("budget")}
          icon="cash-outline"
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
        />
        {cats.data && cats.data.length > 0 ? (
          <View>
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                marginBottom: 8,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("category")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {cats.data.map((cat) => {
                const active = category === cat.slug;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategory(active ? "" : cat.slug)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: c.radius,
                      backgroundColor: active ? c.accent : c.surface,
                      borderWidth: 1,
                      borderColor: active ? c.primary : c.border,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? c.primary : c.foreground,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                      }}
                    >
                      {lang === "ar" && cat.nameAr ? cat.nameAr : cat.nameEn}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
        {error ? (
          <Text
            style={{
              color: c.destructive,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {error}
          </Text>
        ) : null}
        <View style={{ marginTop: 8 }}>
          <Button
            label={t("submit")}
            onPress={onSubmit}
            loading={create.isPending}
          />
        </View>
      </ScrollView>
    </>
  );
}
