# BR-11 Android Device Matrix

Expo SDK 57 supports Android 7+ and targets/compiles API 36. BR-11 therefore tests the minimum supported generation, representative middle releases, and the current target.

| Priority | Android | API | Device class | Required checks | Status |
|---|---:|---:|---|---|---|
| P0 | Android 7 | 24 | Emulator, 2–3 GB RAM profile | cold start, email login, session restore, profile photo library, foreground location, deep link | Pending EAS APK |
| P0 | Android 10 | 29 | Physical or emulator | camera, library, permission denial/retry, chat/realtime reconnect, background → foreground | Pending EAS APK |
| P0 | Android 13 | 33 | Physical device preferred | media permission model, camera, approximate/precise location behavior, auth restore | Pending EAS APK |
| P0 | Android 16 | 36 | Emulator + physical device when available | target-SDK behavior, deep links, background lifecycle, network reconnect, full smoke suite | Pending EAS APK |

## Required native smoke suite on every P0 row

1. Install the same BR-11 development APK; no WebView shell.
2. Launch from terminated state and sign in with a controlled Beta account.
3. Terminate and reopen the app; session must restore without another password prompt.
4. Background for at least 60 seconds, foreground again, and confirm authenticated queries still work.
5. Open `myfan://auth/callback`; Expo Router must resolve the native route instead of a browser 404.
6. Open a profile deep link such as `myfan://profile/myfan1` and an Activity deep link such as `myfan://activity/myfan1`.
7. Choose a profile/Activity image from the library.
8. Capture a profile image with camera; deny camera once and verify a readable error instead of a crash.
9. Trigger Nearby/location; test both grant and deny. Exact coordinates must never be exposed in another user's UI.
10. Toggle network off/on and verify retry/reconnect without duplicate mutation side effects.
11. Logout globally, kill/reopen app, and confirm the old session is not restored.

## Additional recommended coverage

- One low-memory Android device or emulator.
- One Samsung device and one Pixel/AOSP device when available.
- Font/display scaling at 1.0× and a larger accessibility setting.
- Wi-Fi ↔ mobile-data transition on a physical device.

Do not mark this matrix PASS from Expo Go. Deep-link and native-library parity must be verified with the EAS development build.
