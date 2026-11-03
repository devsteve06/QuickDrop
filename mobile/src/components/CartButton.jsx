import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCart } from "../state/cart";
import { colors, radius, spacing, typography } from "../theme";

export default function CartButton() {
  const router = useRouter();
  const { itemCount } = useCart();

  return (
    <Pressable
      onPress={() => router.push("/cart")}
      accessibilityRole="button"
      accessibilityLabel={itemCount > 0 ? `Cart, ${itemCount} items` : "Cart, empty"}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>🛒</Text>
      {itemCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
    borderRadius: radius.md,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    ...typography.tiny,
    color: colors.textInverse,
  },
});
