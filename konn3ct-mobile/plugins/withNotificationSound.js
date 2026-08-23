const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOUND_MODULE_CODE = `package com.onegov.govmeeting.sound

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.SoundPool
import android.media.ToneGenerator
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NativeNotificationSoundModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var soundPool: SoundPool? = null
    private var soundId: Int = 0
    private var soundLoaded: Boolean = false
    private var lastPlayTime: Long = 0

    init {
        initSoundPool()
    }

    private fun initSoundPool() {
        try {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            soundPool = SoundPool.Builder()
                .setMaxStreams(1)
                .setAudioAttributes(audioAttributes)
                .build()

            soundPool?.setOnLoadCompleteListener { _, sampleId, status ->
                if (status == 0) {
                    soundLoaded = true
                    soundId = sampleId
                }
            }

            val resId = reactContext.resources.getIdentifier("gov_chat_notification", "raw", reactContext.packageName)
            if (resId != 0) {
                soundId = soundPool?.load(reactContext, resId, 1) ?: 0
            }
        } catch (e: Exception) {
            soundLoaded = false
        }
    }

    override fun getName(): String {
        return "NativeNotificationSound"
    }

    @ReactMethod
    fun playNotificationSound() {
        val now = System.currentTimeMillis()
        if (now - lastPlayTime < 300) {
            return
        }
        lastPlayTime = now

        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            if (audioManager != null) {
                val mode = audioManager.ringerMode
                if (mode != AudioManager.RINGER_MODE_NORMAL) {
                    return
                }
            }

            if (soundLoaded && soundId != 0 && soundPool != null) {
                soundPool?.play(soundId, 1.0f, 1.0f, 1, 0, 1.0f)
            } else {
                val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
                toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 200)
            }
        } catch (e: Exception) {}
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const SOUND_PACKAGE_CODE = `package com.onegov.govmeeting.sound

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NativeNotificationSoundPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(NativeNotificationSoundModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

const withNotificationSoundKotlinFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java/com/onegov/govmeeting/sound');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'NativeNotificationSoundModule.kt'), SOUND_MODULE_CODE);
      fs.writeFileSync(path.join(dir, 'NativeNotificationSoundPackage.kt'), SOUND_PACKAGE_CODE);

      // Ensure raw folder and sound file exist in res/raw/
      const rawDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/raw');
      fs.mkdirSync(rawDir, { recursive: true });

      const targetSound = path.join(rawDir, 'gov_chat_notification.ogg');
      const sourceSound = path.join(config.modRequest.projectRoot, 'assets/sounds/notification.mp3');
      if (fs.existsSync(sourceSound) && !fs.existsSync(targetSound)) {
        fs.copyFileSync(sourceSound, targetSound);
      }

      return config;
    },
  ]);
};

const withNotificationSoundMainApplication = (config) => {
  return withMainApplication(config, (config) => {
    let content = config.modResults.contents;
    if (!content.includes('NativeNotificationSoundPackage()')) {
      content = content.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n          add(com.onegov.govmeeting.sound.NativeNotificationSoundPackage())'
      );
    }
    config.modResults.contents = content;
    return config;
  });
};

const withNotificationSound = (config) => {
  config = withNotificationSoundKotlinFiles(config);
  config = withNotificationSoundMainApplication(config);
  return config;
};

module.exports = withNotificationSound;
