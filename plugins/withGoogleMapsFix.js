const { withPodfile } = require('@expo/config-plugins');

module.exports = function withGoogleMapsFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // Fix 1: react-native-google-maps pod name (renamed in react-native-maps >= 1.20)
    if (contents.includes("pod 'react-native-google-maps'")) {
      contents = contents.replace(
        /pod 'react-native-google-maps'/g,
        "pod 'react-native-maps/Google'"
      );
      console.log('[withGoogleMapsFix] ✅ react-native-google-maps → react-native-maps/Google');
    } else {
      console.log('[withGoogleMapsFix] ℹ️  pod already patched or not present');
    }

    // Fix 2: AFNetworking imports netinet6/in6.h (private kernel header), blocked by Xcode 26.4+
    // Inject right after `post_install do |installer|` — this line is guaranteed unique in any
    // Expo-generated Podfile, so the injection is reliable regardless of how react_native_post_install
    // is formatted across lines.
    if (!contents.includes('AFNetworkReachabilityManager') && contents.includes('post_install do |installer|')) {
      const afnRuby = [
        '  # [Fix] AFNetworking: netinet6/in6.h is a private kernel header blocked by Xcode 26.4+',
        '  # Strategy 1: disable module compilation on AFNetworking (build settings)',
        '  installer.pods_project.targets.each do |target|',
        "    if target.name == 'AFNetworking'",
        '      target.build_configurations.each do |bc|',
        "        bc.build_settings['CLANG_ENABLE_MODULES'] = 'NO'",
        '      end',
        '    end',
        '  end',
        '  # Strategy 2: remove the offending line from source (belt-and-suspenders)',
        "  afn_file = File.join(installer.sandbox.root, 'AFNetworking/AFNetworking/AFNetworkReachabilityManager.m')",
        '  if File.exist?(afn_file)',
        '    afn_src = File.read(afn_file)',
        "    afn_fixed = afn_src.sub('#import <netinet6/in6.h>', '').sub('#include <netinet6/in6.h>', '')",
        '    File.write(afn_file, afn_fixed) if afn_src != afn_fixed',
        '  end',
      ].join('\n');

      contents = contents.replace(
        'post_install do |installer|',
        'post_install do |installer|\n' + afnRuby
      );
      console.log('[withGoogleMapsFix] ✅ AFNetworking private-header patch injected into post_install');
    } else if (contents.includes('AFNetworkReachabilityManager')) {
      console.log('[withGoogleMapsFix] ℹ️  AFNetworking patch already present');
    } else {
      console.log('[withGoogleMapsFix] ⚠️  post_install block not found — AFNetworking patch skipped');
    }

    config.modResults.contents = contents;
    return config;
  });
};
