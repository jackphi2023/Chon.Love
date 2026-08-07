# BR-11 Status

Last updated: 2026-08-07

| Area | Status | Evidence / next gate |
|---|---|---|
| Native session storage source | Implemented | `auth-storage.native.ts` + Supabase `persistSession: true` |
| Camera/library platform adapter | Implemented | `media-picker.ts`, profile/activity media routed through adapter |
| Location permission adapter | Existing / retained | Browser geolocation + Expo Location foreground permission |
| Deep-link source/config | Implemented | `scheme: myfan`, Expo Router, Auth callback through Expo Linking |
| App lifecycle | Implemented | Query focus + Supabase start/stop auto-refresh |
| EAS development profile | Implemented | `apps/mobile/eas.json`, Android internal APK development client |
| Android device matrix | Defined | `ANDROID-DEVICE-MATRIX.md` |
| WebView prohibition | Automated guard added | BR-11 validator rejects dependency/import/rendering |
| Full GitHub CI | Pending | Must pass on final BR-11 branch/PR head |
| Expo/EAS project link | Pending external configuration | Requires intended Expo account/project; project ID is not invented in source |
| EAS Android APK build | Pending external configuration | Requires Expo/EAS link and build environment |
| Supabase native Auth redirect allowlist | Pending external configuration | Add `myfan://auth/callback` before OAuth/reset native smoke tests |
| Android physical/emulator matrix | Pending APK | Record results after development APK exists |

Do not merge BR-11 as fully device-validated until the pending external/device gates have evidence. Source/CI completion and physical-device completion are tracked separately to prevent false PASS reporting.
