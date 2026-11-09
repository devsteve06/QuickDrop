import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, layout, spacing } from "../theme";

/**
 * Screen shell for every route. The native stack header owns the top inset, so
 * this only reserves the bottom edge (home indicator / gesture bar). On web the
 * safe-area context reports zero insets, and the content is capped and centred
 * by `maxWidth`.
 */
export default function Screen({
  children,
  style,
  padded = true,
  maxWidth = layout.maxContentWidth,
  edges = ["bottom"],
}) {
  return (
    <SafeAreaView edges={edges} style={styles.root}>
      <View style={[styles.content, { maxWidth }, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
  },
  padded: {
    padding: spacing.lg,
  },
});
