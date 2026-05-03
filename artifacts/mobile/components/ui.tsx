import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useI18n } from "@/lib/i18n";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  fullWidth = true,
  size = "md",
}: ButtonProps) {
  const c = useColors();
  const bg =
    variant === "primary"
      ? c.primary
      : variant === "destructive"
      ? c.destructive
      : variant === "secondary"
      ? c.secondary
      : "transparent";
  const fg =
    variant === "primary" || variant === "destructive"
      ? c.primaryForeground
      : variant === "secondary"
      ? c.secondaryForeground
      : c.primary;
  const heightMap = { sm: 38, md: 48, lg: 54 };
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: c.radius,
          height: heightMap[size],
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: c.border,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text
            style={{ color: fg, fontFamily: "Inter_600SemiBold", fontSize: 15 }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
}) {
  const c = useColors();
  const baseStyle: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: c.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onPress();
        }}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.8 : 1 }, style as ViewStyle]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[baseStyle, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  const c = useColors();
  const map = {
    neutral: { bg: c.secondary, fg: c.secondaryForeground },
    primary: { bg: c.accent, fg: c.accentForeground },
    success: { bg: "#DCFCE7", fg: "#166534" },
    warning: { bg: "#FEF3C7", fg: "#92400E" },
    danger: { bg: "#FEE2E2", fg: "#991B1B" },
  } as const;
  const { bg, fg } = map[tone];
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: fg, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
        {label}
      </Text>
    </View>
  );
}

type InputProps = TextInputProps & {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
};

export function Input({ label, icon, error, style, ...rest }: InputProps) {
  const c = useColors();
  const { isRTL } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: error ? c.destructive : c.border,
          borderRadius: c.radius,
          paddingHorizontal: 12,
          height: 48,
          gap: 8,
        }}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={c.mutedForeground} />
        ) : null}
        <TextInput
          {...rest}
          placeholderTextColor={c.mutedForeground}
          style={[
            {
              flex: 1,
              color: c.foreground,
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              textAlign: isRTL ? "right" : "left",
            },
            style,
          ]}
        />
      </View>
      {error ? (
        <Text
          style={{
            color: c.destructive,
            fontSize: 12,
            fontFamily: "Inter_500Medium",
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = "search-outline",
  title,
  hint,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 8 }}>
      <Ionicons name={icon} size={42} color={c.mutedForeground} />
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {hint ? (
        <Text
          style={{
            color: c.mutedForeground,
            fontSize: 13,
            textAlign: "center",
            fontFamily: "Inter_400Regular",
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function LoadingState() {
  const c = useColors();
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const c = useColors();
  const { t } = useI18n();
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
      <Ionicons name="alert-circle-outline" size={42} color={c.destructive} />
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
        }}
      >
        {t("errorTitle")}
      </Text>
      {onRetry ? (
        <Button label={t("retry")} onPress={onRetry} variant="ghost" fullWidth={false} />
      ) : null}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  const { isRTL } = useI18n();
  return (
    <View
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 24,
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          color: c.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 18,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text
            style={{
              color: c.primary,
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Avatar({
  name,
  size = 44,
  uri,
}: {
  name?: string | null;
  size?: number;
  uri?: string | null;
}) {
  const c = useColors();
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.secondary,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: c.accentForeground,
          fontFamily: "Inter_700Bold",
          fontSize: size * 0.38,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({});
