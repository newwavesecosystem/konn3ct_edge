/**
 * Expo Config Plugin: withMeetingService
 *
 * Generates native Kotlin files for the meeting foreground service,
 * registers the service in AndroidManifest.xml with appropriate
 * permissions and foreground service types, and registers the native
 * package in MainApplication.
 *
 * This service keeps WebSocket and audio connections alive when the app
 * is minimized during an active meeting.
 */
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MEETING_SERVICE_CODE = `package com.onegov.govmeeting.meeting

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class KonnMeetingForegroundService : Service() {

    companion object {
        private const val CHANNEL_ID = "meeting_channel"
        private const val NOTIFICATION_ID = 9001
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra("title") ?: "Meeting in progress"
        val serviceType = intent?.getIntExtra("serviceType",
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        ) ?: ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Meeting",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active meeting notification"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
`;

const MEETING_MODULE_CODE = `package com.onegov.govmeeting.meeting

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KonnMeetingServiceModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KonnMeetingService"

    @ReactMethod
    fun start(title: String, serviceTypeFlags: Int) {
        val intent = Intent(reactContext, KonnMeetingForegroundService::class.java).apply {
            putExtra("title", title)
            putExtra("serviceType", serviceTypeFlags)
        }
        ContextCompat.startForegroundService(reactContext, intent)
    }

    @ReactMethod
    fun stop() {
        val intent = Intent(reactContext, KonnMeetingForegroundService::class.java)
        reactContext.stopService(intent)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isAvailable(): Boolean = true
}
`;

const MEETING_PACKAGE_CODE = `package com.onegov.govmeeting.meeting

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KonnMeetingServicePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(KonnMeetingServiceModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function addMeetingServiceSupport(androidManifest) {
  const manifest = androidManifest.manifest;

  // ── 1. Add foreground-service permissions ──────────────────────────────
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }

  const permissions = manifest['uses-permission'];
  const requiredPermissions = [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.FOREGROUND_SERVICE_CAMERA',
  ];

  for (const perm of requiredPermissions) {
    const exists = permissions.some(
      (p) => p.$?.['android:name'] === perm
    );
    if (!exists) {
      permissions.push({ $: { 'android:name': perm } });
    }
  }

  // ── 2. Register KonnMeetingForegroundService inside <application> ──────
  const app = manifest.application[0];
  if (!app.service) {
    app.service = [];
  }

  const serviceName = '.meeting.KonnMeetingForegroundService';
  const serviceExists = app.service.some(
    (s) => s.$?.['android:name'] === serviceName
  );

  if (!serviceExists) {
    app.service.push({
      $: {
        'android:name': serviceName,
        'android:foregroundServiceType': 'mediaPlayback|microphone|camera',
        'android:exported': 'false',
      },
    });
  }

  return androidManifest;
}

const withMeetingServiceKotlinFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java/com/onegov/govmeeting/meeting');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'KonnMeetingForegroundService.kt'), MEETING_SERVICE_CODE);
      fs.writeFileSync(path.join(dir, 'KonnMeetingServiceModule.kt'), MEETING_MODULE_CODE);
      fs.writeFileSync(path.join(dir, 'KonnMeetingServicePackage.kt'), MEETING_PACKAGE_CODE);

      return config;
    },
  ]);
};

const withMeetingServiceMainApplication = (config) => {
  return withMainApplication(config, (config) => {
    let content = config.modResults.contents;
    if (!content.includes('KonnMeetingServicePackage()')) {
      content = content.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n          add(com.onegov.govmeeting.meeting.KonnMeetingServicePackage())'
      );
    }
    config.modResults.contents = content;
    return config;
  });
};

const withMeetingService = (config) => {
  config = withAndroidManifest(config, (config) => {
    config.modResults = addMeetingServiceSupport(config.modResults);
    return config;
  });
  config = withMeetingServiceKotlinFiles(config);
  config = withMeetingServiceMainApplication(config);
  return config;
};

module.exports = withMeetingService;
