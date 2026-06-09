/**
 * Inboria mobile design tokens — dark-only brand, mirrored 1:1 from the web
 * app (artifacts/ncv-mail/src/index.css). The app always renders dark
 * (Inboria is a dark-only product), so `light` and `dark` share one palette.
 *
 * Core tokens are converted from the web HSL custom properties:
 *   --background 220 40% 7%   --foreground 0 0% 100%
 *   --card 225 25% 12%        --primary 210 65% 50%  (#2D80D2)
 *   --border 217 25% 18%      --muted-foreground 216 18% 62%
 *   --sidebar 220 33% 11%
 * Mail-specific tokens reproduce the --mail-* CSS variables exactly.
 */

const palette = {
  // Legacy aliases (kept for components already referencing them)
  text: "#FFFFFF",
  tint: "#2D80D2",

  // Core surfaces
  background: "#0B0E15",
  foreground: "#FFFFFF",

  // Cards / elevated surfaces
  card: "#171C26",
  cardForeground: "#FFFFFF",

  // Primary action color (Inboria blue — web --primary 210 65% 50%)
  primary: "#2D80D2",
  primaryForeground: "#FFFFFF",

  // Secondary surfaces
  secondary: "#1A2130",
  secondaryForeground: "#E5E9F0",

  // Muted / subdued
  muted: "#1A2130",
  mutedForeground: "#8B95A7",
  faint: "#5A6270",

  // Accent — AI / summary highlight (web --mail-summary-text)
  accent: "#B8C5D6",
  accentForeground: "#0B0E15",

  // Status
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  success: "#22C55E",
  warning: "#F59E0B",

  // Borders / inputs
  border: "#222B39",
  input: "#161B24",

  // Brand gradient (used as a subtle fallback only)
  gradientStart: "#2D80D2",
  gradientEnd: "#22C1C3",

  // Interaction
  surfaceHover: "#1A2130",
  unread: "#2D80D2",

  // Mail-specific (mirror web CSS vars, dark)
  mailRead: "#7A8290",
  mailMuted: "#8B95A7",
  mailFaint: "#5A6270",
  mailMeta: "#6B7280",
  mailMetaHover: "#B8C5D6",
  mailBorder: "#2F3845",
  mailSummary: "#B8C5D6",

  // Avatar / chips
  avatarBg: "rgba(45,128,210,0.15)",
  avatarBorder: "rgba(45,128,210,0.32)",
  chipBg: "rgba(255,255,255,0.04)",
  chipActiveBg: "rgba(45,128,210,0.15)",
  chipActiveBorder: "rgba(45,128,210,0.40)",
};

const colors = {
  light: palette,
  dark: palette,
  radius: 14,
};

export default colors;
