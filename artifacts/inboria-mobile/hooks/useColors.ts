import colors from "@/constants/colors";

/**
 * Returns Inboria's design tokens. The app is dark-only by brand, so the
 * dark palette is always returned regardless of the device appearance.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
