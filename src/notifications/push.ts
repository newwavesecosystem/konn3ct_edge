import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { logger } from '../logger';
import { db } from '../db';

const expo = new Expo();

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
  } catch (error) {
    logger.error(`Error in sendPushNotification for user ${userId}`, error);
  }
}
