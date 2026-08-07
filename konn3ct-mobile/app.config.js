// Gov Conference — dedicated branch (gov1_mobile)
const APP_NAME = 'Gov Conference';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: 'konn3ct',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#023c69',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.onegov.govmeeting',
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription: `Allow ${APP_NAME} to access your camera for video meetings.`,
        NSMicrophoneUsageDescription: `Allow ${APP_NAME} to access your microphone for video meetings.`,
        NSPhotoLibraryUsageDescription: `Allow ${APP_NAME} to access your photo library to upload event images.`,
      },
    },
    android: {
      package: 'com.onegov.govmeeting',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#0a5c36',
        foregroundImage: './assets/adaptive-icon.png',
      },
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'MODIFY_AUDIO_SETTINGS',
        'VIBRATE',
        'RECEIVE_BOOT_COMPLETED',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_MEDIA_PROJECTION',
        'FOREGROUND_SERVICE_MICROPHONE',
      ],
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        '@config-plugins/react-native-webrtc',
        {
          cameraPermission: `Allow ${APP_NAME} to access your camera for video meetings.`,
          microphonePermission: `Allow ${APP_NAME} to access your microphone for video meetings.`,
        },
      ],
      'expo-secure-store',
      [
        'expo-local-authentication',
        {
          faceIDPermission: `Allow ${APP_NAME} to use Face ID for secure login.`,
        },
      ],
      'expo-notifications',
      [
        'expo-image-picker',
        {
          photosPermission: `Allow ${APP_NAME} to access your photos to upload event images.`,
        },
      ],
      './plugins/withPiP',
      './plugins/withScreenShare',
      './plugins/withMeetingService',
      './plugins/withNotificationSound',
      'expo-audio',
    ],
    extra: {
          "eas": {
            "projectId": "9a37c584-561d-4e54-a152-6b8a32218f2b"
          }
        }
  },
};
