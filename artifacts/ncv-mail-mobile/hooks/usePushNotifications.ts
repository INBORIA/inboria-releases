import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

let Notifications: typeof import("expo-notifications") | null = null;
let Device: typeof import("expo-device") | null = null;
let Constants: typeof import("expo-constants").default | null = null;

try {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
  Constants = require("expo-constants").default;

  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch {
  Notifications = null;
  Device = null;
  Constants = null;
}

function getProjectId(): string | undefined {
  if (!Constants) return undefined;
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (fromConfig) return fromConfig;
  const easConfig = (Constants as Record<string, unknown>).easConfig as
    | Record<string, string>
    | undefined;
  return easConfig?.projectId ?? undefined;
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web" || !Notifications || !Device) return null;
  if (!Device.isDevice) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("urgent-emails", {
        name: "Emails urgents",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#ef4444",
        sound: "default",
      });
    }

    return tokenData.data;
  } catch {
    return null;
  }
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const router = useRouter();
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  const handleNotificationResponse = useCallback(
    (response: { notification: { request: { content: { data: Record<string, unknown> | undefined } } } }) => {
      const data = response.notification.request.content.data;
      if (data?.emailId) {
        router.push(`/email/${data.emailId}`);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!Notifications) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) setExpoPushToken(token);
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {});

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(handleNotificationResponse as Parameters<typeof Notifications.addNotificationResponseReceivedListener>[0]);

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationResponse]);

  return { expoPushToken };
}
