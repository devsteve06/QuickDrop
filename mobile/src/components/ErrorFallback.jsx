import Screen from "./Screen";
import StateView from "./StateView";

/**
 * Expo Router renders this when a route throws during render. `retry`
 * re-mounts the route; the cart lives in a provider above the boundary, so a
 * retry never loses it.
 */
export default function ErrorFallback({ error, retry }) {
  const message =
    __DEV__ && error?.message
      ? error.message
      : "The screen hit an unexpected error. Try again — your cart is safe.";

  return (
    <Screen>
      <StateView
        emoji="⚠️"
        title="Something went wrong"
        message={message}
        actionLabel="Try again"
        onAction={retry}
      />
    </Screen>
  );
}
