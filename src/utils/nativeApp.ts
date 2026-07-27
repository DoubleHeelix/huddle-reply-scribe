import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

export type AppTheme = "light" | "dark";

export const MOBILE_AUTH_REDIRECT_URL = "huddleassistant://auth";

export function getAuthRedirectUrl(): string {
  return Capacitor.isNativePlatform()
    ? MOBILE_AUTH_REDIRECT_URL
    : `${window.location.origin}/`;
}

export async function syncNativeTheme(_theme: AppTheme): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // The native shell uses a branded navy system-bar background in both themes.
    // Keeping the icons light avoids a low-contrast transition while the WebView
    // switches between the light and dark palettes.
    await SystemBars.setStyle({
      style: SystemBarsStyle.Dark,
    });
  } catch (error) {
    console.warn("Unable to update native system-bar appearance", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
