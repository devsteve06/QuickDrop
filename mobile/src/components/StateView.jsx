import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import { colors, spacing, typography } from "../theme";

export default function StateView({
  loading = false,
  emoji = "🍽️",
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) {
  return (
    <View style={styles.wrap}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <Text style={styles.emoji}>{emoji}</Text>
      )}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <Button
          title={secondaryActionLabel}
          onPress={onSecondaryAction}
          variant="ghost"
          style={styles.secondary}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 44,
  },
  title: {
    ...typography.title,
    marginTop: spacing.sm,
    color: colors.text,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 420,
  },
  action: {
    marginTop: spacing.md,
    minWidth: 160,
  },
  secondary: {
    marginTop: spacing.xs,
  },
});
