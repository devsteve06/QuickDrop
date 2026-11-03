import { StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import Card from "./Card";
import QuantityStepper from "./QuantityStepper";
import { formatMoney } from "../lib/format";
import { colors, spacing, typography } from "../theme";

export default function MenuItemRow({ item, qty, onAdd, onIncrement, onDecrement }) {
  return (
    <Card style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.name}>{item.name}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        <Text style={styles.price}>{formatMoney(item.price)}</Text>
      </View>

      <View style={styles.action}>
        {qty > 0 ? (
          <QuantityStepper
            qty={qty}
            min={0}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            label={item.name}
          />
        ) : (
          <Button
            title="Add"
            size="sm"
            onPress={onAdd}
            accessibilityLabel={`Add ${item.name} to cart`}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
  },
  description: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 19,
  },
  price: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.xs,
  },
  action: {
    alignItems: "flex-end",
  },
});
