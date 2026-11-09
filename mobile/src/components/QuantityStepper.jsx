import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, focusRing, layout, radius, spacing, typography } from "../theme";

export default function QuantityStepper({
  qty,
  onIncrement,
  onDecrement,
  min = 1,
  max = 99,
  label = "item",
}) {
  const canDecrement = qty > min;
  const canIncrement = qty < max;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onDecrement}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label} quantity`}
        accessibilityState={{ disabled: !canDecrement }}
        style={({ pressed, focused }) => [
          styles.button,
          !canDecrement && styles.buttonDisabled,
          pressed && canDecrement && styles.buttonPressed,
          focused && styles.buttonFocused,
        ]}
      >
        <Text style={[styles.symbol, !canDecrement && styles.symbolDisabled]}>−</Text>
      </Pressable>

      <Text
        style={styles.qty}
        accessibilityLabel={`Quantity ${qty}`}
        accessibilityLiveRegion="polite"
      >
        {qty}
      </Text>

      <Pressable
        onPress={onIncrement}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label} quantity`}
        accessibilityState={{ disabled: !canIncrement }}
        style={({ pressed, focused }) => [
          styles.button,
          !canIncrement && styles.buttonDisabled,
          pressed && canIncrement && styles.buttonPressed,
          focused && styles.buttonFocused,
        ]}
      >
        <Text style={[styles.symbol, !canIncrement && styles.symbolDisabled]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    padding: 2,
    gap: spacing.xs,
  },
  button: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  buttonPressed: {
    backgroundColor: colors.primarySoft,
  },
  buttonDisabled: {
    backgroundColor: colors.surface,
  },
  buttonFocused: {
    backgroundColor: colors.primarySoft,
    ...focusRing,
  },
  symbol: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 22,
  },
  symbolDisabled: {
    color: colors.textSubtle,
  },
  qty: {
    ...typography.subtitle,
    color: colors.text,
    minWidth: 20,
    textAlign: "center",
  },
});
