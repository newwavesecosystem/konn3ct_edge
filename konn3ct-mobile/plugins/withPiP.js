const { withAndroidManifest, withDangerousMod, withMainActivity, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PIP_MODULE_CODE = `package com.onegov.govmeeting.pip

import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class PipModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        var isMeetingActive = false
        var staticReactContext: ReactApplicationContext? = null
    }

    init {
        staticReactContext = reactContext
    }

    override fun getName(): String {
        return "KonnPip"
    }

    @ReactMethod
    fun enterPipMode(width: Int, height: Int) {
        val activity = reactContext.currentActivity ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(width, height))
                .build()
            activity.enterPictureInPictureMode(params)
        }
    }

    @ReactMethod
    fun setMeetingActive(active: Boolean) {
        isMeetingActive = active
        val activity = reactContext.currentActivity ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val params = PictureInPictureParams.Builder()
                .setAutoEnterEnabled(active)
                .build()
            activity.setPictureInPictureParams(params)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const PIP_RECEIVER_CODE = `package com.onegov.govmeeting.pip

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import com.onegov.govmeeting.MainActivity

class PipActionsReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_TOGGLE_MUTE = "ACTION_TOGGLE_MUTE"
        const val ACTION_LEAVE = "ACTION_LEAVE"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_TOGGLE_MUTE -> {
                PipModule.staticReactContext?.let { reactContext ->
                    val params = Arguments.createMap()
                    params.putString("action", "toggle_mute")
                    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("KonnPipAction", params)
                }
            }
            ACTION_LEAVE -> {
                val returnIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(returnIntent)

                PipModule.staticReactContext?.let { reactContext ->
                    val params = Arguments.createMap()
                    params.putString("action", "leave")
                    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("KonnPipAction", params)
                }
            }
        }
    }
}
`;

const PIP_PACKAGE_CODE = `package com.onegov.govmeeting.pip

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PipPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(PipModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function addPiPSupport(androidManifest) {
  const app = androidManifest.manifest.application[0];
  const activity = app.activity.find(
    (a) => a.$['android:name'] === '.MainActivity'
  );

  if (activity) {
    activity.$['android:supportsPictureInPicture'] = 'true';
    delete activity.$['android:screenOrientation'];
    
    const configChanges = activity.$['android:configChanges'] || '';
    const newConfigChanges = [
      'orientation', 'keyboardHidden', 'keyboard', 'screenSize', 'locale',
      'layoutDirection', 'fontScale', 'screenLayout', 'density', 'smallestScreenSize', 'uiMode'
    ];
    const mergedConfigChanges = Array.from(
      new Set([...configChanges.split('|'), ...newConfigChanges])
    ).filter(Boolean).join('|');
    activity.$['android:configChanges'] = mergedConfigChanges;
  }

  if (!app.receiver) {
    app.receiver = [];
  }
  const hasReceiver = app.receiver.some(r => r.$['android:name'] === '.pip.PipActionsReceiver');
  if (!hasReceiver) {
    app.receiver.push({
      $: {
        'android:name': '.pip.PipActionsReceiver',
        'android:exported': 'false'
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'ACTION_TOGGLE_MUTE' } },
            { $: { 'android:name': 'ACTION_RETURN_TO_APP' } }
          ]
        }
      ]
    });
  }

  return androidManifest;
}

const MIC_ON_XML = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,14c1.66,0 3,-1.34 3,-3V5c0,-1.66 -1.34,-3 -3,-3S9,3.34 9,5v6c0,1.66 1.34,3 3,3zm5.3,-3c0,3 -2.54,5.1 -5.3,5.1S6.7,14 6.7,11H5c0,3.41 2.72,6.23 6,6.72V21h2v-3.28c3.28,-0.49 6,-3.31 6,-6.72h-1.7z"/>
</vector>`;

const MIC_OFF_XML = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M19,11h-1.7c0,1.58 -0.7,3.01 -1.82,4.02l1.22,1.22C18.15,14.86 19,13.03 19,11zm-7,3c1.66,0 3,-1.34 3,-3V7.61l-5.74,-5.74c0.24,-0.12 0.51,-0.19 0.8,-0.19 1.66,0 3,1.34 3,3v6c0,0.13 -0.02,0.26 -0.06,0.38l2,2C14.8,14.65 15,14.34 15,14zm-7.71,-11.13L3,4.15l5.06,5.06V11c0,1.66 1.34,3 3,3 0.35,0 0.68,-0.06 0.99,-0.17l2.8,2.8C13.88,16.85 12.98,17 12,17c-3.28,0 -6,-2.72 -6,-6.1H4.3c0,3.71 2.82,6.76 6.5,7.24V21h2.4v-2.86c0.85,-0.11 1.66,-0.37 2.41,-0.74l3.18,3.18 1.27,-1.27L4.29,2.87z"/>
</vector>`;

const LEAVE_XML = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,9c-1.6,0 -3.15,0.25 -4.6,0.72v3.1c0,0.39 -0.23,0.74 -0.56,0.9 -1.33,0.67 -2.48,1.59 -3.42,2.7 -0.22,0.27 -0.56,0.41 -0.9,0.41 -0.23,0 -0.46,-0.06 -0.67,-0.2L0.42,15.4c-0.34,-0.27 -0.48,-0.73 -0.34,-1.14 1.48,-4.27 5.53,-7.26 10.22,-7.26s8.74,2.99 10.22,7.26c0.14,0.41 0,0.87 -0.34,1.14l-1.43,1.23c-0.21,0.14 -0.44,0.2 -0.67,0.2 -0.34,0 -0.68,-0.14 -0.9,-0.41 -0.94,-1.11 -2.09,-2.03 -3.42,-2.7 -0.33,-0.16 -0.56,-0.51 -0.56,-0.9v-3.1C15.15,9.25 13.6,9 12,9z"/>
</vector>`;

const withPiPKotlinFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java/com/onegov/govmeeting/pip');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'PipModule.kt'), PIP_MODULE_CODE);
      fs.writeFileSync(path.join(dir, 'PipActionsReceiver.kt'), PIP_RECEIVER_CODE);
      fs.writeFileSync(path.join(dir, 'PipPackage.kt'), PIP_PACKAGE_CODE);

      // Drawables
      const drawableDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, 'ic_pip_mic_on.xml'), MIC_ON_XML);
      fs.writeFileSync(path.join(drawableDir, 'ic_pip_mic_off.xml'), MIC_OFF_XML);
      fs.writeFileSync(path.join(drawableDir, 'ic_pip_leave.xml'), LEAVE_XML);

      return config;
    },
  ]);
};

const withPiPMainActivity = (config) => {
  return withMainActivity(config, (config) => {
    let content = config.modResults.contents;

    const imports = `
import android.app.PictureInPictureParams
import android.app.PendingIntent
import android.app.RemoteAction
import android.content.Intent
import android.graphics.drawable.Icon
import com.onegov.govmeeting.pip.PipModule
import com.onegov.govmeeting.pip.PipActionsReceiver
import com.facebook.react.modules.core.DeviceEventManagerModule
`;
    if (!content.includes('import com.onegov.govmeeting.pip.PipModule')) {
      content = content.replace('import android.os.Bundle', 'import android.os.Bundle\n' + imports);
    }

    const overrides = `
  fun updatePipActions(isMuted: Boolean) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode) {
          val muteIntent = Intent(this, PipActionsReceiver::class.java).apply {
              action = PipActionsReceiver.ACTION_TOGGLE_MUTE
          }
          val mutePendingIntent = PendingIntent.getBroadcast(
              this, 101, muteIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          )
          
          val iconRes = if (isMuted) R.drawable.ic_pip_mic_off else R.drawable.ic_pip_mic_on
          val title = if (isMuted) "Unmute" else "Mute"
          val description = if (isMuted) "Unmute microphone" else "Mute microphone"
          
          val micAction = RemoteAction(
              Icon.createWithResource(this, iconRes),
              title,
              description,
              mutePendingIntent
          )

          val leaveIntent = Intent(this, PipActionsReceiver::class.java).apply {
              action = PipActionsReceiver.ACTION_LEAVE
          }
          val leavePendingIntent = PendingIntent.getBroadcast(
              this, 102, leaveIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          )
          val leaveAction = RemoteAction(
              Icon.createWithResource(this, R.drawable.ic_pip_leave),
              "Leave",
              "Leave Meeting",
              leavePendingIntent
          )

          val params = PictureInPictureParams.Builder()
              .setActions(listOf(micAction, leaveAction))
              .build()
          setPictureInPictureParams(params)
      }
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: android.content.res.Configuration) {
      super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
      if (isInPictureInPictureMode) {
          updatePipActions(false)
      }

      PipModule.staticReactContext?.let { reactContext ->
          reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit("KonnPipModeChanged", isInPictureInPictureMode)
      }
  }

  override fun onUserLeaveHint() {
      super.onUserLeaveHint()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
          if (PipModule.isMeetingActive) {
              val params = PictureInPictureParams.Builder().build()
              enterPictureInPictureMode(params)
          }
      }
  }
`;
    if (!content.includes('onPictureInPictureModeChanged')) {
      content = content.replace('class MainActivity : ReactActivity() {', 'class MainActivity : ReactActivity() {' + overrides);
    }

    config.modResults.contents = content;
    return config;
  });
};

const withPiPMainApplication = (config) => {
  return withMainApplication(config, (config) => {
    let content = config.modResults.contents;
    if (!content.includes('PipPackage()')) {
      content = content.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n          add(com.onegov.govmeeting.pip.PipPackage())'
      );
    }
    config.modResults.contents = content;
    return config;
  });
};

const withPiP = (config) => {
  config = withAndroidManifest(config, (config) => {
    config.modResults = addPiPSupport(config.modResults);
    return config;
  });
  config = withPiPKotlinFiles(config);
  config = withPiPMainActivity(config);
  config = withPiPMainApplication(config);
  return config;
};

module.exports = withPiP;
