const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Makes every `expo prebuild` wire the Android `release` build type to a real
 * upload keystore instead of the debug key Expo ships by default.
 *
 * This plugin does NOT contain any secrets. It just emits Gradle code that
 * reads the actual keystore path + passwords from Gradle properties at build
 * time. Put the real values in ~/.gradle/gradle.properties (never in this
 * repo, never in app.json):
 *
 *   MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
 *   MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
 *   MYAPP_UPLOAD_STORE_PASSWORD=your-store-password
 *   MYAPP_UPLOAD_KEY_PASSWORD=your-key-password
 *
 * Register it in app.json with no options:
 *   "plugins": ["./plugins/withAndroidReleaseSigning.js"]
 */
module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Add a `release` block inside signingConfigs, if one isn't already there.
    const hasReleaseSigningConfig = /signingConfigs\s*\{[\s\S]*?release\s*\{/.test(contents);

    if (!hasReleaseSigningConfig) {
      contents = contents.replace(
        /signingConfigs\s*\{/,
        `signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }`,
      );
    }

    // 2. Point buildTypes.release at signingConfigs.release instead of .debug.
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.)debug/,
      '$1release',
    );

    config.modResults.contents = contents;
    return config;
  });
};
