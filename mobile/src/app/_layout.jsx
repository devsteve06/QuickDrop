import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#f7f7f9" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "QuickDrop" }} />
      </Stack>
    </>
  );
}
