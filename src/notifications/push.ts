import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import webPush from 'web-push';
import { logger } from '../logger';
import { db } from '../db';

const expo = new Expo();

// Set VAPID details for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'dummy_public_key';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'dummy_private_key';
if (VAPID_PUBLIC_KEY !== 'dummy_public_key') {
  webPush.setVapidDetails(
    'mailto:support@konn3ct.net',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: any) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true }
    });

    if (!user || !user.expoPushToken) {
      return; // No token registered
    }

    if (!Expo.isExpoPushToken(user.expoPushToken)) {
      logger.error(`Invalid Expo push token for user ${userId}: ${user.expoPushToken}`);
      return;
    }

    const message: ExpoPushMessage = {
      to: user.expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        logger.error(`Failed to send push notification chunk to user ${userId}`, error);
      }
    }

    // Web Push
    if (user.webPushSubscription) {
      try {
        const subscription = JSON.parse(user.webPushSubscription);
        const payload = JSON.stringify({
          title,
          body,
          url: data?.slug ? `/join/${data.slug}` : '/'
        });
        await webPush.sendNotification(subscription, payload);
      } catch (error) {
        logger.error(`Failed to send web push to user ${userId}`, error);
      }
    }
  } catch (error) {
    logger.error(`Error in sendPushNotification for user ${userId}`, error);
  }
}
