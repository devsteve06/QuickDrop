import { useNetworkState } from "expo-network";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, spacing, typography } from "../theme";

// Approximate height of the native stack header. The banner floats just below
// it so it never covers the screen title or the cart button.
const HEADER_HEIGHT = 64;

/**
 * Global connectivity notice. It appears only when the OS reports a
 * disconnected network, and disappears as soon as connectivity returns.
 * A server that is down while the device is online is reported by each
 * screen's error state instead, because its message is actionable.
 */
export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const network = useNetworkState();

  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.host, { top: insets.top + HEADER_HEIGHT }]}
    >
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.banner}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.text}>
          You’re offline. Menus and orders will load again when you reconnect.
        </Text>
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
    zIndex: 900,
  },
  banner: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    flex: 1,
    ...typography.small,
    color: colors.text,
    lineHeight: 18,
  },
});
