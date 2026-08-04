const { withAndroidManifest } = require('@expo/config-plugins');

function addPiPSupport(androidManifest) {
  const app = androidManifest.manifest.application[0];
  const activity = app.activity.find(
    (a) => a.$['android:name'] === '.MainActivity'
  );

  if (activity) {
    activity.$['android:supportsPictureInPicture'] = 'true';
    
    // Remove fixed screenOrientation — Android 12+ blocks PiP when it's set.
    // Orientation is locked programmatically in MainActivity.onCreate instead.
    delete activity.$['android:screenOrientation'];
    
    const configChanges = activity.$['android:configChanges'] || '';
    const newConfigChanges = [
      'orientation',
      'keyboardHidden',
      'keyboard',
      'screenSize',
      'locale',
      'layoutDirection',
      'fontScale',
      'screenLayout',
      'density',
      'smallestScreenSize',
      'uiMode'
    ];

    // Merge existing configChanges with new ones, removing duplicates
    const mergedConfigChanges = Array.from(
      new Set([...configChanges.split('|'), ...newConfigChanges])
    ).filter(Boolean).join('|');

    activity.$['android:configChanges'] = mergedConfigChanges;
  }

  return androidManifest;
}

const withPiP = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults = addPiPSupport(config.modResults);
    return config;
  });
};

module.exports = withPiP;

