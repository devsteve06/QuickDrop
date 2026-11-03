import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import { formatMoney, pluralize } from "../lib/format";
import { useCart } from "../state/cart";
import { colors, spacing, typography } from "../theme";

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, itemCount, total } = useCart();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.navigate("/cart");
  }

  return (
    <Screen style={styles.screen}>
      <Card style={styles.card}>
        <Text style={styles.emoji}>🧾</Text>
        <Text style={styles.title}>Checkout is next</Text>
        <Text style={styles.body}>
          Guest details, server-computed totals, and simulated payment land in Phase 5. Your cart
          is ready for the last step.
        </Text>

        {itemCount > 0 ? (
          <Text style={styles.summary}>
            {pluralize(itemCount, "item")} from {cart.restaurantName} · {formatMoney(total)}
          </Text>
        ) : (
          <Text style={styles.summary}>Your cart is empty.</Text>
        )}

        <Button title="Back to cart" fullWidth onPress={goBack} />
        <Button
          title="Browse restaurants"
          variant="secondary"
          fullWidth
          onPress={() => router.navigate("/")}
          style={styles.secondary}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
  },
  card: {
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  summary: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  secondary: {
    marginTop: spacing.xs,
  },
});
