import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";

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
        hitSlop={6}
        style={({ pressed }) => [
          styles.button,
          !canDecrement && styles.buttonDisabled,
          pressed && canDecrement && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.symbol, !canDecrement && styles.symbolDisabled]}>−</Text>
      </Pressable>

      <Text style={styles.qty} accessibilityLabel={`Quantity ${qty}`}>
        {qty}
      </Text>

      <Pressable
        onPress={onIncrement}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label} quantity`}
        accessibilityState={{ disabled: !canIncrement }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.button,
          !canIncrement && styles.buttonDisabled,
          pressed && canIncrement && styles.buttonPressed,
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
    padding: 3,
    gap: spacing.sm,
  },
  button: {
    width: 32,
    height: 32,
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
