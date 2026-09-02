const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withAndroidOutputName(
  config,
  customName = 'baby-buddy-mobile-dashboard',
) {
  return withAppBuildGradle(config, (modConfig) => {
    // Check if the script modification hasn't already been injected
    if (!modConfig.modResults.contents.includes('variant.outputs.all')) {
      const gradleExtension = `
android {
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            outputFileName = "${customName}-\${variant.versionName}.apk"
        }
    }
}
`;
      // Append the block to the end of android/app/build.gradle
      modConfig.modResults.contents += gradleExtension;
    }
    return modConfig;
  });
};
