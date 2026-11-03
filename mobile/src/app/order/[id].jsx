import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../api/client";
import { payOrdered, wasAlreadyPaid } from "../../api/orderFlow";
import { useOrder } from "../../api/queries";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Screen from "../../components/Screen";
import StateView from "../../components/StateView";
import { formatMoney, formatOrderTime, pluralize } from "../../lib/format";
import { useCart } from "../../state/cart";
import { colors, radius, spacing, typography } from "../../theme";

const STATUS = {
  pending_payment: { label: "Awaiting payment", tone: "warning" },
  preparing: { label: "Preparing", tone: "success" },
  out_for_delivery: { label: "On the way", tone: "success" },
  delivered: { label: "Delivered", tone: "success" },
};

const statusFor = (status) =>
  STATUS[status] ?? {
    label: status ? status.replace(/_/g, " ") : "Unknown",
    tone: "neutral",
  };

export default function OrderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const { status, data: order, error, retry: refresh } = useOrder(id);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);

  function startNewOrder() {
    clearCart();
    router.replace("/");
  }

  async function handlePay() {
    if (paying || !order) return;

    setPaying(true);
    setPayError(null);

    const outcome = await payOrdered(order.id, api.payOrder);
    if (outcome.paid || wasAlreadyPaid(outcome.error)) {
      refresh();
    } else {
      setPayError(outcome.error.message);
    }
    setPaying(false);
  }

  if (status === "loading") {
    return (
      <Screen>
        <StateView loading title="Loading your order" />
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen>
        <StateView
          emoji="📡"
          title="We couldn't load this order"
          message={error?.message}
          actionLabel="Try again"
          onAction={refresh}
          secondaryActionLabel="Browse restaurants"
          onSecondaryAction={() => router.replace("/")}
        />
      </Screen>
    );
  }

  const badge = statusFor(order.status);
  const eta = order.restaurant?.delivery_minutes;
  const placedAt = formatOrderTime(order.created_at);
  const awaitingPayment = order.status === "pending_payment";
  const itemCount = order.items.reduce((count, line) => count + line.qty, 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.hero}>
          <Text style={styles.emoji}>{order.restaurant?.emoji || "🍽️"}</Text>
          <Text style={styles.title}>Order #{order.id}</Text>
          <View style={[styles.badge, styles[`badge_${badge.tone}`]]}>
            <Text style={[styles.badgeText, styles[`badgeText_${badge.tone}`]]}>
              {badge.label}
            </Text>
          </View>

          <Text style={styles.heroLine}>
            {awaitingPayment
              ? "Your order is saved. Complete payment to send it to the kitchen."
              : eta
                ? `Arriving in about ${eta} minutes.`
                : "Payment received. The restaurant is preparing your order."}
          </Text>
          {placedAt ? <Text style={styles.heroMeta}>Placed {placedAt}</Text> : null}
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{order.restaurant?.name ?? "Your items"}</Text>
            <Text style={styles.cardMeta}>{pluralize(itemCount, "item")}</Text>
          </View>
          <View style={styles.lines}>
            {order.items.map((line, index) => (
              <View key={`${line.name}-${index}`} style={styles.line}>
                <Text style={styles.lineName}>
                  {line.qty} × {line.name}
                </Text>
                <Text style={styles.linePrice}>{formatMoney(line.price * line.qty)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Subtotal</Text>
              <Text style={styles.rowValue}>{formatMoney(order.subtotal)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Delivery</Text>
              <Text style={styles.rowValue}>{formatMoney(order.delivery_fee)}</Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatMoney(order.total)}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Delivering to</Text>
          <Text style={styles.deliveryName}>{order.customer_name}</Text>
          <Text style={styles.deliveryAddress}>{order.address}</Text>
          {order.phone ? <Text style={styles.deliveryMeta}>{order.phone}</Text> : null}
        </Card>

        {awaitingPayment ? (
          <View style={styles.payBlock}>
            {payError ? (
              <Text style={styles.payError} accessibilityRole="alert">
                {payError}
              </Text>
            ) : null}
            <Button
              title={`Pay ${formatMoney(order.total)}`}
              fullWidth
              loading={paying}
              onPress={handlePay}
            />
          </View>
        ) : (
          <Button title="Order again" fullWidth onPress={startNewOrder} />
        )}

        <Button
          title={awaitingPayment ? "Back to home" : "Browse restaurants"}
          variant="secondary"
          fullWidth
          onPress={() => router.replace("/")}
          style={styles.secondary}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hero: {
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  badge_warning: {
    backgroundColor: colors.primarySoft,
  },
  badge_success: {
    backgroundColor: colors.successSoft,
  },
  badge_neutral: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    ...typography.tiny,
    textTransform: "uppercase",
  },
  badgeText_warning: {
    color: colors.primary,
  },
  badgeText_success: {
    color: colors.success,
  },
  badgeText_neutral: {
    color: colors.textMuted,
  },
  heroLine: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
    lineHeight: 21,
  },
  heroMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  cardMeta: {
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
  deliveryName: {
    ...typography.subtitle,
    color: colors.text,
  },
  deliveryAddress: {
    ...typography.body,
    color: colors.text,
    lineHeight: 21,
  },
  deliveryMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
  payBlock: {
    gap: spacing.sm,
  },
  payError: {
    ...typography.body,
    color: colors.danger,
  },
  secondary: {
    marginTop: spacing.xs,
  },
});
