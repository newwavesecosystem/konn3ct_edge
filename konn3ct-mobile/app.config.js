const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Gov Conference';

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
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.konn3ct.mobile',
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription: `Allow ${APP_NAME} to access your camera for video meetings.`,
        NSMicrophoneUsageDescription: `Allow ${APP_NAME} to access your microphone for video meetings.`,
        NSPhotoLibraryUsageDescription: `Allow ${APP_NAME} to access your photo library to upload event images.`,
      },
    },
    android: {
      package: 'com.konn3ct.mobile',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#ffffff',
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
    ],
  },
};
