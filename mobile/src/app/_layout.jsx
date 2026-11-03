import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AlertHost from "../components/AlertHost";
import CartButton from "../components/CartButton";
import { CartProvider } from "../state/cart";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <CartProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontWeight: "700" },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerRight: () => <CartButton />,
        }}
      >
        <Stack.Screen name="index" options={{ title: "QuickDrop" }} />
        <Stack.Screen name="restaurant/[id]" options={{ title: "Menu" }} />
        <Stack.Screen name="cart" options={{ title: "Your cart" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="order/[id]" options={{ title: "Order" }} />
      </Stack>
      <AlertHost />
    </CartProvider>
  );
}
