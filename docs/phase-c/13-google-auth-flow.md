# Phiên 13 — Google registration and login

## Decision

MyFan uses Google as the primary account creation and sign-in method for V1. A successful Google OAuth session does not require a separate MyFan OTP challenge.

This does not bypass the product safety gate. Every newly created account is routed to the mandatory DOB/18+, Terms and Community Standards onboarding before social features are available.

## Cross-platform flow

```text
Splash
→ restore existing Supabase session
→ no session: Google sign-in screen
→ Supabase Auth Google OAuth using PKCE
→ callback: myfan://auth/callback on native or current Expo Web origin
→ exchange authorization code for Supabase session
→ get_my_onboarding_status
→ incomplete: /(onboarding)
→ complete: /(tabs)
```

Google sign-in automatically creates a Supabase Auth user when the Google identity is new. Existing database triggers then create the public profile, default user role and economy accounts.

## OTP policy

- No SMS OTP is requested after Google authentication.
- No email OTP screen is present in the V1 Google flow.
- Google account authentication and consent remain controlled by Google.
- MyFan's DOB/18+ verification is a separate product compliance step, not an authentication OTP.

## Security controls

- OAuth uses authorization code + PKCE.
- The client exchanges the returned code with Supabase Auth.
- Service-role and Google client secrets are never bundled in the app.
- Raw OAuth errors are mapped to user-safe Vietnamese messages.
- New accounts cannot enter social tabs until age and policy checks pass.
- Web sessions persist through the Supabase browser storage adapter.
- Native session persistence remains in-memory until encrypted native storage is added; users may need to sign in again after a full app restart.

## Required dashboard configuration before end-to-end testing

1. Create a Google OAuth Web client in Google Cloud.
2. Configure its authorized redirect URI with the Supabase callback shown in Authentication → Providers → Google.
3. Add the Google client ID and client secret to the Supabase Google provider.
4. Add these redirect destinations to Supabase Auth URL Configuration:
   - `myfan://auth/callback`
   - the Expo Web local callback origin used by the development server
   - the approved Netlify mobile-web callback URL
5. Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the Supabase publishable key in local, Netlify and EAS environment settings. Do not commit it to the repository.
6. Test both a new Google identity and a returning Google identity.

## Acceptance criteria

- A user can tap “Tiếp tục với Google”.
- No MyFan OTP screen is shown.
- A new Google identity creates exactly one auth user and one profile/economy bootstrap set.
- Returning users reuse the same Supabase user ID.
- New users are sent to onboarding 18+.
- Completed users are sent to the main tabs.
- Sign-out clears the active Supabase session.
