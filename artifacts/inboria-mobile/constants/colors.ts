/**
 * Inboria mobile design tokens — dark-only brand (violet → turquoise),
 * matching the web app's "Linear/Superhuman" aesthetic.
 *
 * The palette is intentionally duplicated under both `light` and `dark`
 * keys so the app always renders in dark mode regardless of the device's
 * appearance setting (Inboria is a dark-only product).
 */

const palette = {
  // Legacy aliases
  text: "#F4F6FB",
  tint: "#8B5CF6",

  // Core surfaces
  background: "#0B0B0F",
  foreground: "#F4F6FB",

  // Cards / elevated surfaces
  card: "#15151D",
  cardForeground: "#F4F6FB",

  // Primary action color (violet)
  primary: "#8B5CF6",
  primaryForeground: "#FFFFFF",

  // Secondary surfaces
  secondary: "#1C1C26",
  secondaryForeground: "#E5E9F0",

  // Muted / subdued (timestamps, placeholders, read text)
  muted: "#1C1C26",
  mutedForeground: "#8B95A7",
  faint: "#5A6270",

  // Accent (turquoise) — AI highlights, selected states
  accent: "#2DD4BF",
  accentForeground: "#04201C",

  // Status
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  success: "#22C55E",
  warning: "#F59E0B",

  // Borders / inputs
  border: "#23232E",
  input: "#1C1C26",

  // Brand gradient
  gradientStart: "#7C3AED",
  gradientEnd: "#2DD4BF",

  // Interaction
  surfaceHover: "#1F1F2A",
  unread: "#8B5CF6",
};

const colors = {
  light: palette,
  dark: palette,
  radius: 14,
};

export default colors;
