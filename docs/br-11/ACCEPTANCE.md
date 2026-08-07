# BR-11 Acceptance Criteria

## Automated/source gates

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm validate:native-parity` passes.
- [ ] Full application CI passes: workspace, environments, BR-01→BR-11 validators, lint, typecheck, unit tests, web builds.
- [ ] Existing database/browser workflows remain green; BR-11 introduces no migration or server contract change.
- [ ] `expo-secure-store` backs native Supabase auth persistence.
- [ ] Web continues to use browser storage; no SecureStore dependency is required at runtime on web.
- [ ] App lifecycle starts/stops Supabase auth refresh on foreground/background.
- [ ] Camera and library permission paths are explicit through a shared mobile platform adapter.
- [ ] Existing Expo Location foreground-permission adapter remains intact.
- [ ] `scheme` remains `myfan` and Auth callback uses Expo Linking.
- [ ] EAS `development` profile creates an internal Android APK development client.
- [ ] No `react-native-webview` dependency/import/rendering is present.

## External/device gates

- [ ] `apps/mobile` is linked to the intended Expo/EAS project.
- [ ] EAS build environment contains only public client configuration; no service-role/secret server key is exposed.
- [ ] Supabase Auth allowlist contains `myfan://auth/callback` before native OAuth/reset testing.
- [ ] EAS Android development build completes successfully from the exact BR-11 commit.
- [ ] APK installs and launches on the Android matrix in `ANDROID-DEVICE-MATRIX.md`.
- [ ] Email/password session restores after force-close/reopen.
- [ ] Global logout remains logged out after force-close/reopen.
- [ ] Camera grant/deny works without crash.
- [ ] Library grant/deny works without crash.
- [ ] Location grant/deny works without exposing exact coordinates to other users.
- [ ] Deep links route natively for Auth, profile and Activity.
- [ ] Background → foreground resumes authenticated queries and realtime behavior.
- [ ] Network off/on recovers without duplicate mutation side effects.

BR-11 is source-complete only when automated gates pass. It is fully complete only after the EAS build and device gates are recorded as PASS; do not mark pending external gates as passed by inference.
