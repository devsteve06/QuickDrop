import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>⚡ QuickDrop</Text>
      <Text style={styles.tagline}>Mobile MVP scaffold is ready.</Text>
      <Text style={styles.hint}>
        Restaurant browsing lands in Phase 3.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
    backgroundColor: "#f7f7f9",
  },
  logo: {
    fontSize: 34,
    fontWeight: "800",
    color: "#111827",
  },
  tagline: {
    fontSize: 16,
    color: "#374151",
  },
  hint: {
    fontSize: 14,
    color: "#6b7280",
  },
});
