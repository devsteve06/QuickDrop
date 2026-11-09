import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRestaurants } from "../api/queries";
import RestaurantCard from "../components/RestaurantCard";
import Screen from "../components/Screen";
import StateView from "../components/StateView";
import { colors, layout, spacing, typography } from "../theme";

const TWO_COLUMN_MIN_WIDTH = 720;
const THREE_COLUMN_MIN_WIDTH = 1024;

export default function HomeScreen() {
  const { status, data, error, retry } = useRestaurants();
  const { width, fontScale } = useWindowDimensions();

  // A multi-column grid becomes cramped when the user has large text enabled.
  const wideText = fontScale > 1.3;
  const columns = wideText
    ? 1
    : width >= THREE_COLUMN_MIN_WIDTH
      ? 3
      : width >= TWO_COLUMN_MIN_WIDTH
        ? 2
        : 1;

  if (status === "loading" && !data) {
    return (
      <Screen>
        <StateView
          loading
          title="Loading restaurants…"
          message="Fetching today's restaurants from the QuickDrop API."
        />
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen>
        <StateView
          emoji="📡"
          title="We couldn't load restaurants"
          message={error?.message}
          actionLabel="Try again"
          onAction={retry}
        />
      </Screen>
    );
  }

  const restaurants = data ?? [];

  return (
    <Screen padded={false}>
      <FlatList
        key={`restaurant-grid-${columns}`}
        data={restaurants}
        keyExtractor={(restaurant) => String(restaurant.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.kicker}>QUICKDROP</Text>
            <Text style={styles.title} accessibilityRole="header">
              What are you hungry for?
            </Text>
            <Text style={styles.subtitle}>
              {restaurants.length > 0
                ? `${restaurants.length} restaurants near you.`
                : "Fresh picks from the neighbourhood."}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <StateView
            emoji="🍽️"
            title="No restaurants yet"
            message="The API has no restaurants. Run `npm run seed` in the repo root, then refresh."
            actionLabel="Refresh"
            onAction={retry}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <RestaurantCard restaurant={item} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  row: {
    gap: spacing.lg,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  kicker: {
    ...typography.tiny,
    color: colors.primary,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
});
