import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));

function expect(condition, message) {
  if (!condition) throw new Error(`[BR-11] ${message}`);
}

function collectSourceFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules', '.expo'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...collectSourceFiles(absolute));
    else if (/\.(?:ts|tsx|js|jsx|json)$/u.test(entry.name)) result.push(absolute);
  }
  return result;
}

const mobilePackage = readJson('apps/mobile/package.json');
const appConfig = readJson('apps/mobile/app.json').expo;
const eas = readJson('apps/mobile/eas.json');
const supabase = read('apps/mobile/src/lib/supabase.ts');
const nativeStorage = read('apps/mobile/src/lib/auth-storage.native.ts');
const webStorage = read('apps/mobile/src/lib/auth-storage.ts');
const lifecycle = read('apps/mobile/src/providers/app-providers.tsx');
const mediaPicker = read('apps/mobile/src/lib/media-picker.ts');
const location = read('apps/mobile/src/lib/location.ts');
const auth = read('apps/mobile/src/lib/auth.ts');
const matrix = read('docs/br-11/ANDROID-DEVICE-MATRIX.md');

expect(mobilePackage.dependencies['expo-secure-store']?.startsWith('~57.'), 'expo-secure-store must be pinned to Expo SDK 57.');
expect(mobilePackage.dependencies['expo-dev-client']?.startsWith('~57.'), 'expo-dev-client must be pinned to Expo SDK 57.');
expect(appConfig.scheme === 'myfan', 'expo.scheme must remain myfan for native deep links.');
expect(appConfig.android?.package === 'com.myfan.mobile.dev', 'BR-11 must keep the development Android package ID.');
expect(JSON.stringify(appConfig.plugins).includes('expo-secure-store'), 'SecureStore config plugin is required.');
expect(JSON.stringify(appConfig.plugins).includes('expo-image-picker'), 'Image picker config plugin is required.');
expect(JSON.stringify(appConfig.plugins).includes('expo-location'), 'Location config plugin is required.');
expect(JSON.stringify(appConfig.plugins).includes('expo-dev-client'), 'Development client config plugin is required.');

expect(eas.build?.development?.developmentClient === true, 'EAS development profile must set developmentClient=true.');
expect(eas.build?.development?.distribution === 'internal', 'EAS development profile must use internal distribution.');
expect(eas.build?.development?.android?.buildType === 'apk', 'Android development build must produce an installable APK.');

expect(supabase.includes('persistSession: true'), 'Supabase session persistence must be enabled on native.');
expect(supabase.includes('storage: mobileAuthStorage'), 'Supabase must use the platform auth storage adapter.');
expect(nativeStorage.includes("from 'expo-secure-store'"), 'Native auth storage must use Expo SecureStore.');
expect(nativeStorage.includes('CHUNK_SIZE'), 'Native auth storage must guard against large SecureStore payloads.');
expect(webStorage.includes('= undefined'), 'Web auth storage adapter must defer to Supabase browser storage.');

expect(lifecycle.includes('startAutoRefresh()'), 'Native lifecycle must start Supabase token refresh when active.');
expect(lifecycle.includes('stopAutoRefresh()'), 'Native lifecycle must stop Supabase token refresh in background.');
expect(mediaPicker.includes('requestCameraPermissionsAsync'), 'Camera permission must be requested explicitly.');
expect(mediaPicker.includes('requestMediaLibraryPermissionsAsync'), 'Media library permission must be requested explicitly on native.');
expect(location.includes('requestForegroundPermissionsAsync'), 'Foreground location permission must remain explicit.');
expect(auth.includes("Linking.createURL('auth/callback'"), 'Auth callback must be generated through Expo Linking for native deep links.');

expect(matrix.includes('Android 7'), 'Android minimum supported OS must be represented in the device matrix.');
expect(matrix.includes('Android 16'), 'Android API 36/current target must be represented in the device matrix.');

const mobileSource = collectSourceFiles(path.join(root, 'apps/mobile'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
expect(!mobilePackage.dependencies['react-native-webview'], 'react-native-webview dependency is forbidden in BR-11.');
expect(!mobileSource.includes("from 'react-native-webview'"), 'WebView imports are forbidden; native UI must remain native.');
expect(!mobileSource.includes('<WebView'), 'WebView rendering is forbidden; native UI must remain native.');

console.warn('BR-11 native parity source validation passed.');
