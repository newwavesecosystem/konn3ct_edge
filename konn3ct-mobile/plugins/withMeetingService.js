/**
 * Expo Config Plugin: withMeetingService
 *
 * Registers the MeetingForegroundService in AndroidManifest.xml and adds
 * the FOREGROUND_SERVICE_MICROPHONE permission required by Android 14+ (API 34).
 *
 * This service keeps WebSocket and audio connections alive when the app
 * is minimized during an active meeting.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function addMeetingServiceSupport(androidManifest) {
  const manifest = androidManifest.manifest;

  // ── 1. Add FOREGROUND_SERVICE_MICROPHONE permission ─────────────────────
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }

  const permissions = manifest['uses-permission'];
  const requiredPermissions = [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  ];

  for (const perm of requiredPermissions) {
    const exists = permissions.some(
      (p) => p.$?.['android:name'] === perm
    );
    if (!exists) {
      permissions.push({ $: { 'android:name': perm } });
    }
  }

  // ── 2. Register MeetingForegroundService inside <application> ───────────
  const app = manifest.application[0];
  if (!app.service) {
    app.service = [];
  }

  const serviceName = 'com.konn3ct.mobile.MeetingForegroundService';
  const serviceExists = app.service.some(
    (s) => s.$?.['android:name'] === serviceName
  );

  if (!serviceExists) {
    app.service.push({
      $: {
        'android:name': serviceName,
        'android:foregroundServiceType': 'microphone',
        'android:exported': 'false',
      },
    });
  }

  return androidManifest;
}

const withMeetingService = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults = addMeetingServiceSupport(config.modResults);
    return config;
  });
};

module.exports = withMeetingService;
