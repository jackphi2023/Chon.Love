import type { MemberPhotoVerificationResult } from '@/lib/member-photo-verification';

type AwsFaceLivenessProps = {
  disabled?: boolean;
  onResult: (result: MemberPhotoVerificationResult) => void;
  onError: (message: string) => void;
};

// The production Chon.Love release currently targets mobile web for AWS Face Liveness.
// Keep a native-safe module so Expo native bundles never import browser-only Amplify UI.
// Native capture continues through the existing LiveSelfieCamera path in onboarding/selfie.
export function AwsFaceLiveness(_props: AwsFaceLivenessProps) {
  return null;
}
