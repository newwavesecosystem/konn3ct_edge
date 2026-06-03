/**
 * Ambient module declarations for packages whose bundled typings are not
 * automatically resolved by `moduleResolution: Node`.  These stubs satisfy
 * the compiler; actual runtime behaviour is unchanged.
 */

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: Record<string, unknown>);
    send(command: unknown): Promise<unknown>;
  }
  export class PutObjectCommand {
    constructor(input: Record<string, unknown>);
  }
}

declare module 'expo-server-sdk' {
  export interface ExpoPushMessage {
    to: string | string[];
    sound?: 'default' | null;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }
  export interface ExpoPushTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: Record<string, unknown>;
  }
  export class Expo {
    static isExpoPushToken(token: unknown): boolean;
    chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][];
    sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
  }
}
