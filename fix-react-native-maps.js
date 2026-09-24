const { readFile, writeFile } = require('fs').promises;
const { existsSync } = require('fs');

async function runScript() {
  const chalk = await import('chalk');

  function log(...args) {
    console.log(chalk.default.yellow('[postinstall]'), ...args);
  }

  async function fixSslPinning() {
    const gradlePath = 'node_modules/react-native-ssl-pinning/android/build.gradle';
    if (!existsSync(gradlePath)) {
      log('ssl-pinning: not found — skipping');
      return;
    }
    let content = await readFile(gradlePath, 'utf-8');
    if (!content.includes('jcenter()')) {
      log('ssl-pinning: ✅ already patched');
      return;
    }
    // Remove the buildscript block — uses jcenter() (removed in Gradle 9) and pins
    // AGP 2.3.0. The root project already provides AGP on the classpath, so this block
    // is redundant and breaks Gradle 9 builds.
    content = content.replace(/\nbuildscript \{[\s\S]*?\n\}\n/, '\n');
    await writeFile(gradlePath, content, 'utf-8');
    log('ssl-pinning: ✅ patched (removed legacy buildscript block)');
  }

  async function reactNativeMaps() {
    const modulePath = 'node_modules/react-native-maps';

    // v1.27.2+ has src/ structure with native MapView.web.ts — no shim needed
    if (existsSync(`${modulePath}/src/MapView.web.ts`)) {
      log('✅ v1.27.2+ detected — web support built-in, no shim required');
      return;
    }

    // Legacy path for react-native-maps < 1.27.2 (lib/ structure)
    const libIndex = `${modulePath}/lib/index.web.js`;
    const libDts = `${modulePath}/lib/index.d.ts`;
    if (!existsSync(`${modulePath}/lib`)) {
      log('⚠️  lib/ directory not found — skipping web shim');
      return;
    }

    log('📦 Creating web compatibility shim (legacy lib/ structure)');
    await writeFile(libIndex, 'module.exports = {}', 'utf-8');
    if (existsSync(libDts)) {
      const { copyFile } = require('fs').promises;
      await copyFile(libDts, `${modulePath}/lib/index.web.d.ts`);
    }
    const pkg = JSON.parse(await readFile(`${modulePath}/package.json`));
    pkg['react-native'] = 'lib/index.js';
    pkg['main'] = 'lib/index.web.js';
    await writeFile(`${modulePath}/package.json`, JSON.stringify(pkg, null, 2), 'utf-8');
    log('✅ script ran successfully');
  }

  await fixSslPinning();
  await reactNativeMaps();
}

runScript();
