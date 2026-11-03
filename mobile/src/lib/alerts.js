import { Alert, Platform } from "react-native";

/**
 * Platform alert helper. Native uses the system alert; web has no blocking alert in
 * React Native Web, so notices are forwarded to <AlertHost /> and rendered as a banner.
 */
const listeners = new Set();

export function showAlert(title, message = "") {
  if (Platform.OS === "web") {
    for (const listener of listeners) listener({ title, message });
    return;
  }
  Alert.alert(title, message);
}

export function subscribeToAlerts(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
