import { useId, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, focusRing, radius, spacing, typography } from "../theme";

export default function TextField({
  label,
  error,
  helper,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);
  const hintId = useId();
  const describedBy = error || helper ? hintId : undefined;

  // ARIA-only props: react-native-web forwards them to the DOM, while native
  // uses accessibilityHint below.
  const webAria =
    Platform.OS === "web"
      ? { "aria-invalid": Boolean(error), "aria-describedby": describedBy }
      : null;

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        {...webAria}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        accessibilityHint={error ?? helper}
        placeholderTextColor={colors.textSubtle}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, focused && styles.inputFocused, error && styles.inputError, inputStyle]}
      />
      {error ? (
        <Text
          nativeID={hintId}
          style={styles.error}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : helper ? (
        <Text nativeID={hintId} style={styles.helper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.primary,
    ...focusRing,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  error: {
    ...typography.small,
    color: colors.danger,
  },
  helper: {
    ...typography.small,
    color: colors.textMuted,
  },
});
