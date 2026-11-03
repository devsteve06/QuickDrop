import { StyleSheet, View } from "react-native";
import { colors, layout, spacing } from "../theme";

export default function Screen({ children, style, padded = true }) {
  return (
    <View style={styles.root}>
      <View style={[styles.content, padded && styles.padded, style]}>{children}</View>
    </View>
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
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  padded: {
    padding: spacing.lg,
  },
});
