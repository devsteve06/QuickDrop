import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { subscribeToAlerts } from "../lib/alerts";
import { colors, radius, shadows, spacing, typography } from "../theme";

const DISMISS_AFTER_MS = 5000;

export default function AlertHost() {
  const [notice, setNotice] = useState(null);

  useEffect(() => subscribeToAlerts(setNotice), []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View style={styles.banner} accessibilityRole="alert">
        <View style={styles.body}>
          <Text style={styles.title}>{notice.title}</Text>
          {notice.message ? <Text style={styles.message}>{notice.message}</Text> : null}
        </View>
        <Pressable
          onPress={() => setNotice(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={8}
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    zIndex: 1000,
  },
  banner: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  message: {
    ...typography.small,
    color: colors.textMuted,
  },
  close: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
