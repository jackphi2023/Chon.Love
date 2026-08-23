# SIGNUP-R02 — Selfie completion → Connect

Production audit found that selfie auto-approval activates the profile synchronously, but the client previously cleared its signup draft and navigated without confirming the authenticated destination. A freshly mounted protected tabs layout could then observe onboarding state and bounce the user back. The onboarding root also retained an ambiguous `/(tabs)` redirect which may collapse to `/` on Expo Web.

This fix:

- confirms `getAuthenticatedDestination()` resolves to the concrete `/(tabs)/connect` route before leaving the approved selfie screen;
- gives the `/connect` protected-layout gate a bounded activation re-check instead of immediately bouncing back to onboarding;
- keeps a web hard-navigation fallback to `/connect` if Expo Router fails to leave `/onboarding/selfie`;
- replaces the residual active-profile `/(tabs)` redirect in onboarding with `/(tabs)/connect`;
- automatically attempts foreground GPS capture once on the location step while preserving the browser/OS permission prompt and province-only fallback;
- does not expose exact coordinates in Search results; existing Search V2 continues to rank usable GPS near→far, then same province/city, then nationwide.

No database contract change is required.