import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../api/client";
import { payOrdered, placeOrder, wasAlreadyPaid } from "../api/orderFlow";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import StateView from "../components/StateView";
import TextField from "../components/TextField";
import { toOrderPayload, validateCheckout } from "../lib/checkoutValidation";
import { formatMoney, pluralize } from "../lib/format";
import { useCart } from "../state/cart";
import { colors, radius, spacing, typography } from "../theme";

const EMPTY_FIELDS = { customerName: "", address: "", phone: "" };

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, hydrated, itemCount, subtotal, total, clearCart } = useCart();

  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [errors, setErrors] = useState({});
  const [phase, setPhase] = useState("idle");
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const submitting = phase === "submitting";

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.navigate("/cart");
  }

  function updateField(name, value) {
    setFields((current) => ({ ...current, [name]: value }));
    // Clear the message as soon as the user starts fixing the field.
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }

  function handlePaymentFailure(orderId, error) {
    setPendingOrderId(orderId);
    setSubmitError(
      `Order #${orderId} was placed, but the payment step failed: ${error.message}`
    );
    setPhase("pay_failed");
  }

  async function finishPayment(orderId) {
    const outcome = await payOrdered(orderId, api.payOrder);

    // 409 means the order is already past pending_payment: the payment landed but
    // the response did not. Treat it as settled rather than showing an error.
    if (outcome.paid || wasAlreadyPaid(outcome.error)) {
      clearCart();
      router.replace(`/order/${orderId}`);
      return;
    }

    handlePaymentFailure(orderId, outcome.error);
  }

  async function handleSubmit() {
    if (submitting) return;

    const result = validateCheckout(fields);
    setErrors(result.errors);
    if (!result.valid) return;

    setSubmitError(null);

    // Retrying after a failed payment must not create a second order.
    if (pendingOrderId) {
      setPhase("submitting");
      await finishPayment(pendingOrderId);
      return;
    }

    setPhase("submitting");
    try {
      const outcome = await placeOrder(
        api.createOrder,
        api.payOrder,
        toOrderPayload(cart, result.values)
      );

      if (outcome.paid || wasAlreadyPaid(outcome.error)) {
        clearCart();
        router.replace(`/order/${outcome.orderId}`);
        return;
      }

      handlePaymentFailure(outcome.orderId, outcome.error);
    } catch (error) {
      setSubmitError(error.message);
      setPhase("idle");
    }
  }

  if (!hydrated) {
    return (
      <Screen>
        <StateView loading title="Loading your cart" />
      </Screen>
    );
  }

  if (itemCount === 0) {
    return (
      <Screen>
        <StateView
          emoji="🛒"
          title="Your cart is empty"
          message="Add something tasty from a restaurant before checking out."
          actionLabel="Browse restaurants"
          onAction={() => router.navigate("/")}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Delivery details</Text>
            <Text style={styles.cardHint}>
              {pendingOrderId
                ? "This order already exists, so its details are locked."
                : "Guest checkout — no account needed."}
            </Text>

            <TextField
              label="Name"
              value={fields.customerName}
              onChangeText={(value) => updateField("customerName", value)}
              placeholder="Alex Rivera"
              autoComplete="name"
              autoCapitalize="words"
              returnKeyType="next"
              editable={!pendingOrderId}
              error={errors.customerName}
            />

            <TextField
              label="Address"
              value={fields.address}
              onChangeText={(value) => updateField("address", value)}
              placeholder="12 Bridge Street, Flat 3"
              autoComplete="street-address"
              returnKeyType="next"
              editable={!pendingOrderId}
              error={errors.address}
            />

            <TextField
              label="Phone"
              value={fields.phone}
              onChangeText={(value) => updateField("phone", value)}
              placeholder="+44 7700 900123"
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="done"
              editable={!pendingOrderId}
              error={errors.phone}
              helper="Optional — only used for delivery updates."
            />
          </Card>

          <Card style={styles.card}>
            <View style={styles.restaurantRow}>
              <Text style={styles.restaurantEmoji}>{cart.restaurantEmoji || "🍽️"}</Text>
              <View style={styles.restaurantBody}>
                <Text style={styles.restaurantName}>{cart.restaurantName}</Text>
                <Text style={styles.restaurantMeta}>{pluralize(itemCount, "item")}</Text>
              </View>
            </View>

            <View style={styles.lines}>
              {cart.items.map((line) => (
                <View key={line.id} style={styles.line}>
                  <Text style={styles.lineName}>
                    {line.qty} × {line.name}
                  </Text>
                  <Text style={styles.linePrice}>{formatMoney(line.price * line.qty)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.totals}>
              <Row label="Subtotal" value={formatMoney(subtotal)} />
              <Row label="Delivery" value={formatMoney(cart.deliveryFee)} />
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatMoney(total)}</Text>
              </View>
            </View>

            <Text style={styles.note}>
              The server re-prices every line from its own database when the order is placed, so
              the final total may differ by a cent.
            </Text>
          </Card>

          {submitError ? (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorTitle}>
                {phase === "pay_failed" ? "Payment didn’t go through" : "We couldn’t place the order"}
              </Text>
              <Text style={styles.errorText}>{submitError}</Text>
              {pendingOrderId ? (
                <Text style={styles.errorText}>
                  Your order is saved. Use “Try payment again” below — it will not create a second
                  order.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Button
            title={
              pendingOrderId
                ? "Try payment again"
                : `Place order · ${formatMoney(total)}`
            }
            fullWidth
            loading={submitting}
            onPress={handleSubmit}
          />
          <Button
            title="Back to cart"
            variant="secondary"
            fullWidth
            disabled={submitting}
            onPress={goBack}
            style={styles.secondary}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  cardHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  restaurantEmoji: {
    fontSize: 30,
  },
  restaurantBody: {
    flex: 1,
    gap: 2,
  },
  restaurantName: {
    ...typography.subtitle,
    color: colors.text,
  },
  restaurantMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
  lines: {
    gap: spacing.xs,
  },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  lineName: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  linePrice: {
    ...typography.body,
    color: colors.text,
  },
  totals: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
  },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    ...typography.subtitle,
    color: colors.text,
  },
  totalValue: {
    ...typography.title,
    color: colors.text,
  },
  note: {
    ...typography.small,
    color: colors.textSubtle,
    lineHeight: 18,
  },
  errorBanner: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  errorTitle: {
    ...typography.label,
    color: colors.danger,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    lineHeight: 20,
  },
  secondary: {
    marginTop: spacing.xs,
  },
});
