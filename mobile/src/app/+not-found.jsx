import { useRouter } from "expo-router";
import Screen from "../components/Screen";
import StateView from "../components/StateView";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <StateView
        emoji="🧭"
        title="Page not found"
        message="That link doesn’t match a QuickDrop screen. Head back to the restaurant list to keep ordering."
        actionLabel="Browse restaurants"
        onAction={() => router.replace("/")}
      />
    </Screen>
  );
}
