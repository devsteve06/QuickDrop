import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRestaurant } from "../../api/queries";
import MenuItemRow from "../../components/MenuItemRow";
import Screen from "../../components/Screen";
import StateView from "../../components/StateView";
import { showAlert } from "../../lib/alerts";
import { formatMoney } from "../../lib/format";
import { useConfirm } from "../../lib/useConfirm";
import { MAX_QTY, useCart } from "../../state/cart";
import { colors, focusRing, layout, radius, shadows, spacing, typography } from "../../theme";

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { status, data, error, retry } = useRestaurant(id);
  const cart = useCart();
  const [dialog, confirm] = useConfirm();

  const restaurant = data;
  const restaurantSummary = restaurant
    ? {
        id: restaurant.id,
        name: restaurant.name,
        emoji: restaurant.emoji,
        deliveryFee: restaurant.delivery_fee,
      }
    : null;

  async function handleAdd(item) {
    if (!restaurantSummary) return;

    if (cart.qtyFor(item.id) >= MAX_QTY) {
      showAlert("Maximum quantity reached", `You can order up to ${MAX_QTY} of a single item.`);
      return;
    }

    const entry = { id: item.id, name: item.name, price: item.price };
    const fromAnotherRestaurant =
      cart.cart.restaurantId !== null && cart.cart.restaurantId !== restaurantSummary.id;

    if (fromAnotherRestaurant) {
      const confirmed = await confirm({
        title: "Start a new cart?",
        message: `Your cart already has items from ${cart.cart.restaurantName}. Adding ${item.name} will clear it.`,
        confirmLabel: "Start new cart",
        cancelLabel: "Keep old cart",
        destructive: true,
      });
      if (!confirmed) return;
      cart.replaceWithItem(restaurantSummary, entry);
      return;
    }

    cart.addItem(restaurantSummary, entry);
  }

  function handleDecrement(item) {
    if (cart.qtyFor(item.id) <= 1) cart.removeItem(item.id);
    else cart.decrement(item.id);
  }

  if (status === "loading" && !restaurant) {
    return (
      <Screen>
        <StateView loading title="Loading the menu…" />
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen>
        <StateView
          emoji="📡"
          title="We couldn't load this restaurant"
          message={error?.message}
          actionLabel="Try again"
          onAction={retry}
          secondaryActionLabel="Browse restaurants"
          onSecondaryAction={() => router.navigate("/")}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: restaurant?.name ?? "Menu" }} />
      {dialog}

      <FlatList
        data={restaurant?.menu ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={restaurant ? <RestaurantHeader restaurant={restaurant} /> : null}
        ListEmptyComponent={
          <StateView
            emoji="🍽️"
            title="No dishes yet"
            message="This restaurant has not published a menu."
          />
        }
        renderItem={({ item }) => (
          <MenuItemRow
            item={item}
            qty={cart.qtyFor(item.id)}
            onAdd={() => handleAdd(item)}
            onIncrement={() => cart.increment(item.id)}
            onDecrement={() => handleDecrement(item)}
          />
        )}
      />

      {cart.itemCount > 0 ? (
        <View style={styles.cartBarWrap} pointerEvents="box-none">
          <Pressable
            onPress={() => router.push("/cart")}
            accessibilityRole="button"
            accessibilityLabel={`View cart, ${cart.itemCount} items, ${formatMoney(cart.total)}`}
            accessibilityHint="Opens your cart"
            style={({ pressed, focused }) => [
              styles.cartBar,
              pressed && styles.cartBarPressed,
              focused && styles.cartBarFocused,
            ]}
          >
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{cart.itemCount}</Text>
            </View>
            <Text style={styles.cartLabel}>View cart</Text>
            <Text style={styles.cartTotal}>{formatMoney(cart.total)}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

function RestaurantHeader({ restaurant }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerEmoji} accessible={false}>
        {restaurant.emoji}
      </Text>
      <Text style={styles.headerName} accessibilityRole="header">
        {restaurant.name}
      </Text>
      <Text style={styles.headerCuisine}>{restaurant.cuisine}</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>⭐ {Number(restaurant.rating).toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>🕒 {restaurant.delivery_minutes} min</Text>
          <Text style={styles.statLabel}>Delivery</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatMoney(restaurant.delivery_fee)}</Text>
          <Text style={styles.statLabel}>Fee</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        Menu
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: 110,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  headerEmoji: {
    fontSize: 48,
  },
  headerName: {
    ...typography.display,
    color: colors.text,
  },
  headerCuisine: {
    ...typography.body,
    color: colors.textMuted,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: spacing.xl,
    rowGap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stat: {
    gap: 2,
  },
  statValue: {
    ...typography.subtitle,
    color: colors.text,
  },
  statLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.lg,
  },
  cartBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    alignItems: "center",
  },
  cartBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
    maxWidth: layout.maxCartBarWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: colors.primary,
    ...shadows.floating,
  },
  cartBarPressed: {
    backgroundColor: colors.primaryPressed,
  },
  cartBarFocused: {
    borderColor: colors.textInverse,
    ...focusRing,
  },
  cartCount: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  cartCountText: {
    ...typography.label,
    color: colors.textInverse,
  },
  cartLabel: {
    flex: 1,
    ...typography.subtitle,
    color: colors.textInverse,
  },
  cartTotal: {
    ...typography.subtitle,
    color: colors.textInverse,
  },
});
