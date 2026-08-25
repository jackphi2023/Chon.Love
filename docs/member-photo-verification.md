# Chon.Love member photo verification

## Runtime contract

`member-photo-verification` compares a live JPEG selfie against up to five uploaded profile images with AWS Rekognition `CompareFaces`.

Chon.Love's business rule is **strictly greater than 60%** similarity against at least one usable uploaded image. The Rekognition API request itself uses a 0% request threshold so the function can observe the actual returned similarity and apply the 60% rule in application logic. This avoids converting every sub-60 result into a misleading 0%.

The function compares multiple uploaded images to reduce false negatives. JPEG and PNG profile images are supported by Rekognition. A provider/configuration failure or an image-quality failure must never be represented as a numeric similarity score.

## Required Supabase Edge Function secrets

These are server-side secrets for the Supabase Edge Function runtime. They must not be exposed to Expo, Netlify browser bundles, or `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` variables.

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` only when temporary AWS credentials are used

The IAM principal should be least-privilege and allow only the Rekognition operation(s) required by this function, currently `rekognition:CompareFaces` in the configured region.

Configure through the Supabase project secret mechanism (Dashboard or CLI), then redeploy `member-photo-verification`. Do not commit secret values to GitHub.

## Pending-state semantics

- `face_similarity_not_above_threshold`: a real similarity score was calculated but did not exceed 60%; show the score and keep manual review.
- `face_comparison_provider_not_configured`: Rekognition credentials/region were unavailable; similarity is `null`, never `0`.
- `face_comparison_quality_or_provider_error`: no reliable score could be calculated; similarity is `null` and the member can retry when the provider is available.
- `declared_gender_changed_during_verification`: profile metadata changed during the request; manual review.

The implementation does **not** infer gender from face appearance. It only checks that the declared profile value did not change during verification. Automated gender inference from a face is intentionally not part of the verification contract.

## Release acceptance

1. CI / typecheck / unit tests pass on the exact PR head.
2. Supabase Edge Function is redeployed from the same GitHub source.
3. Runtime has the required AWS secrets.
4. A known same-person test produces a real non-null similarity score.
5. A deliberately different-person test stays pending below the 60% business threshold.
6. Provider unavailable test returns `maxSimilarity = null` and a system-unavailable message, never `0.0%`.
7. Existing pending cases caused by missing provider become retryable after the provider is restored.
