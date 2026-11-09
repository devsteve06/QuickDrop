import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToAlerts } from "../lib/alerts";
import { colors, focusRing, radius, shadows, spacing, typography } from "../theme";

const DISMISS_AFTER_MS = 5000;
const HEADER_HEIGHT = 64;

export default function AlertHost() {
  const [notice, setNotice] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => subscribeToAlerts(setNotice), []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + HEADER_HEIGHT }]}
    >
      <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <View style={styles.body}>
          <Text style={styles.title}>{notice.title}</Text>
          {notice.message ? <Text style={styles.message}>{notice.message}</Text> : null}
        </View>
        <Pressable
          onPress={() => setNotice(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={8}
          style={({ focused }) => [styles.closeButton, focused && styles.focused]}
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
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -spacing.sm,
    marginRight: -spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  focused: {
    borderColor: colors.primary,
    ...focusRing,
  },
  close: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
