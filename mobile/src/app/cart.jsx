import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import Card from "../components/Card";
import QuantityStepper from "../components/QuantityStepper";
import Screen from "../components/Screen";
import StateView from "../components/StateView";
import { formatMoney } from "../lib/format";
import { useConfirm } from "../lib/useConfirm";
import { useCart } from "../state/cart";
import { colors, spacing, typography } from "../theme";

export default function CartScreen() {
  const router = useRouter();
  const { cart, increment, decrement, removeItem, clearCart, itemCount, subtotal, total } =
    useCart();
  const [dialog, confirm] = useConfirm();

  async function handleClear() {
    const confirmed = await confirm({
      title: "Clear your cart?",
      message: "This removes every item from your cart.",
      confirmLabel: "Clear cart",
      destructive: true,
    });
    if (confirmed) clearCart();
  }

  if (itemCount === 0) {
    return (
      <Screen>
        <StateView
          emoji="🛒"
          title="Your cart is empty"
          message="Add something tasty from a restaurant to get started."
          actionLabel="Browse restaurants"
          onAction={() => router.navigate("/")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {dialog}

      <View style={styles.restaurantRow}>
        <Text style={styles.restaurantEmoji}>{cart.restaurantEmoji || "🍽️"}</Text>
        <View style={styles.restaurantBody}>
          <Text style={styles.restaurantName}>{cart.restaurantName}</Text>
          <Text style={styles.restaurantMeta}>
            {itemCount} {itemCount === 1 ? "item" : "items"} · {formatMoney(cart.deliveryFee)}{" "}
            delivery
          </Text>
        </View>
      </View>

      <FlatList
        style={styles.list}
        data={cart.items}
        keyExtractor={(line) => String(line.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.line}>
            <View style={styles.lineTop}>
              <Text style={styles.lineName}>{item.name}</Text>
              <Text style={styles.lineTotal}>{formatMoney(item.price * item.qty)}</Text>
            </View>
            <Text style={styles.linePrice}>{formatMoney(item.price)} each</Text>
            <View style={styles.lineBottom}>
              <QuantityStepper
                qty={item.qty}
                onIncrement={() => increment(item.id)}
                onDecrement={() => decrement(item.id)}
                label={item.name}
              />
              <Button
                title="Remove"
                variant="ghost"
                size="sm"
                onPress={() => removeItem(item.id)}
                accessibilityLabel={`Remove ${item.name} from cart`}
              />
            </View>
          </Card>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatMoney(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery</Text>
          <Text style={styles.summaryValue}>{formatMoney(cart.deliveryFee)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{formatMoney(total)}</Text>
        </View>
        <Text style={styles.summaryNote}>
          The server recalculates the final total when you place the order.
        </Text>

        <Button title="Go to checkout" fullWidth onPress={() => router.push("/checkout")} />
        <Button
          title="Clear cart"
          variant="danger"
          fullWidth
          onPress={handleClear}
          style={styles.clearButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  restaurantEmoji: {
    fontSize: 34,
  },
  restaurantBody: {
    flex: 1,
    gap: 2,
  },
  restaurantName: {
    ...typography.title,
    color: colors.text,
  },
  restaurantMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  line: {
    gap: spacing.sm,
  },
  lineTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  lineName: {
    flex: 1,
    ...typography.subtitle,
    color: colors.text,
  },
  lineTotal: {
    ...typography.subtitle,
    color: colors.text,
  },
  linePrice: {
    ...typography.small,
    color: colors.textMuted,
  },
  lineBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  summary: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text,
  },
  summaryTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryTotalLabel: {
    ...typography.subtitle,
    color: colors.text,
  },
  summaryTotalValue: {
    ...typography.title,
    color: colors.text,
  },
  summaryNote: {
    ...typography.small,
    color: colors.textSubtle,
    marginBottom: spacing.sm,
  },
  clearButton: {
    marginTop: spacing.xs,
  },
});
