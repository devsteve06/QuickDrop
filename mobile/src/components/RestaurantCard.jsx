import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "../lib/format";
import { colors, focusRing, radius, shadows, spacing, typography } from "../theme";

export default function RestaurantCard({ restaurant }) {
  const router = useRouter();
  const rating = Number(restaurant.rating);
  const fee = formatMoney(restaurant.delivery_fee);

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/restaurant/[id]", params: { id: String(restaurant.id) } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${restaurant.cuisine}, rated ${rating.toFixed(1)}, ${restaurant.delivery_minutes} minutes, ${fee} delivery`}
      accessibilityHint="Opens the menu"
      style={({ pressed, focused }) => [styles.card, pressed && styles.pressed, focused && styles.focused]}
    >
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{restaurant.emoji}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {restaurant.name}
        </Text>
        <Text style={styles.cuisine} numberOfLines={2}>
          {restaurant.cuisine}
        </Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>⭐ {rating.toFixed(1)}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.stat}>🕒 {restaurant.delivery_minutes} min</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.stat}>{fee}</Text>
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  focused: {
    borderColor: colors.primary,
    ...focusRing,
  },
  emojiWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 28,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
  },
  cuisine: {
    ...typography.small,
    color: colors.textMuted,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  stat: {
    ...typography.small,
    color: colors.textMuted,
  },
  dot: {
    ...typography.small,
    color: colors.textSubtle,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSubtle,
  },
});
