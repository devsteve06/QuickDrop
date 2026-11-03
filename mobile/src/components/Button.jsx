import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "../theme";

const VARIANTS = {
  primary: {
    background: colors.primary,
    pressed: colors.primaryPressed,
    border: colors.primary,
    text: colors.textInverse,
  },
  secondary: {
    background: colors.surface,
    pressed: colors.surfaceMuted,
    border: colors.border,
    text: colors.text,
  },
  ghost: {
    background: "transparent",
    pressed: colors.primarySoft,
    border: "transparent",
    text: colors.primary,
  },
  danger: {
    background: colors.dangerSoft,
    pressed: colors.dangerSoft,
    border: colors.dangerSoft,
    text: colors.danger,
  },
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}) {
  const palette = VARIANTS[variant] ?? VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === "sm" && styles.small,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: pressed && !isDisabled ? palette.pressed : palette.background,
          borderColor: palette.border,
        },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <Text style={[styles.label, size === "sm" && styles.labelSmall, { color: palette.text }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  labelSmall: {
    fontSize: 14,
    fontWeight: "600",
  },
});
