import { useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../components/Screen";
import StateView from "../../components/StateView";

export default function OrderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  return (
    <Screen>
      <StateView
        emoji="🧾"
        title={`Order #${id ?? "unknown"}`}
        message="Order confirmation and simulated payment arrive in Phase 5."
        actionLabel="Browse restaurants"
        onAction={() => router.navigate("/")}
      />
    </Screen>
  );
}
