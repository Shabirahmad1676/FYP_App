import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications should be handled when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // 3. Try to get Push Token (Optional for MVP/Development)
    // On Android, this requires Firebase. If it fails, we still allow local notifications!
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('✅ Remote Push Token secured.');
      } else {
        console.log('ℹ️ No EAS Project ID found. Skipping Push Token.');
      }
    } catch (e) {
      console.log('ℹ️ Push Token skipped (Firebase not configured). Local alerts are still active.');
    }
  } else {
    console.log('ℹ️ Must use physical device for Push Notifications');
  }

  return token;
}

export async function sendLocalNotification(title: string, body: string, data: any = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // immediate
  });
}
