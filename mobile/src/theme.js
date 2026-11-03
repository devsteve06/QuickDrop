import { Platform } from "react-native";

export const colors = {
  background: "#f6f7f9",
  surface: "#ffffff",
  surfaceMuted: "#f1f3f7",
  border: "#e4e7ec",
  text: "#0f172a",
  textMuted: "#667085",
  textSubtle: "#98a2b3",
  textInverse: "#ffffff",
  primary: "#ea580c",
  primaryPressed: "#c2410c",
  primarySoft: "#fff4ed",
  success: "#067647",
  successSoft: "#ecfdf3",
  danger: "#b42318",
  dangerSoft: "#fef3f2",
  overlay: "rgba(15, 23, 42, 0.5)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const typography = {
  display: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: "600" },
  small: { fontSize: 13 },
  tiny: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
};

export const shadows = {
  card: Platform.select({
    web: { boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)" },
    default: {
      shadowColor: "#0f172a",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  }),
  floating: Platform.select({
    web: { boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)" },
    default: {
      shadowColor: "#0f172a",
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  }),
};

export const layout = {
  maxContentWidth: 1040,
  maxCartBarWidth: 640,
};
