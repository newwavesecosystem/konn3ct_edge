/**
 * Expo Config Plugin: withScreenShare
 *
 * Adds the required Android permissions and foreground service declaration
 * for screen sharing via react-native-webrtc's built-in MediaProjectionService.
 *
 * Android 14+ (API 34) requires:
 * - FOREGROUND_SERVICE permission
 * - FOREGROUND_SERVICE_MEDIA_PROJECTION permission
 * - A <service> declaration with foregroundServiceType="mediaProjection"
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function addScreenShareSupport(androidManifest) {
  const manifest = androidManifest.manifest;

  // ── 1. Add permissions ──────────────────────────────────────────────────
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }

  const permissions = manifest['uses-permission'];
  const requiredPermissions = [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  ];

  for (const perm of requiredPermissions) {
    const exists = permissions.some(
      (p) => p.$?.['android:name'] === perm
    );
    if (!exists) {
      permissions.push({ $: { 'android:name': perm } });
    }
  }

  // ── 2. Register MediaProjectionService inside <application> ─────────────
  const app = manifest.application[0];
  if (!app.service) {
    app.service = [];
  }

  const serviceName = 'com.oney.WebRTCModule.MediaProjectionService';
  const serviceExists = app.service.some(
    (s) => s.$?.['android:name'] === serviceName
  );

  if (!serviceExists) {
    app.service.push({
      $: {
        'android:name': serviceName,
        'android:foregroundServiceType': 'mediaProjection',
        'android:exported': 'false',
      },
    });
  }

  return androidManifest;
}

const withScreenShare = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults = addScreenShareSupport(config.modResults);
    return config;
  });
};

module.exports = withScreenShare;
