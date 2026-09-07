# Session D — D-AWS01 Face Liveness status

Status: **BLOCKED on external AWS client-credential infrastructure; CompareFaces remains fail-closed and unchanged.**

## Verified candidate state

- `member-photo-verification` uses server-side AWS Rekognition `CompareFacesCommand`.
- Business similarity threshold remains 60%.
- Provider/quality failures remain pending for Admin review; they are not auto-approved.
- No AWS Face Liveness client or `StartFaceLivenessSession` implementation exists in the candidate.

## Required secure Face Liveness architecture

Amazon Rekognition Face Liveness requires this lifecycle:

1. Authenticated Chon.Love backend calls `CreateFaceLivenessSession` and returns a one-use `SessionId`.
2. The web client runs AWS Amplify `FaceLivenessDetector` / `FaceLivenessDetectorCore`, which performs the streaming `StartFaceLivenessSession` call.
3. The client must sign that stream with **temporary, least-privilege AWS credentials**. Long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` must never be exposed to the browser.
4. The authenticated backend calls `GetFaceLivenessSessionResults` and applies a server-owned liveness confidence policy.
5. The returned Face Liveness `ReferenceImage` is then used for Chon.Love's existing server-side face comparison against approved/profile photos.
6. Only after both liveness and face-similarity acceptance succeed may the existing activation RPC run; every provider/error/low-confidence path remains fail-closed to pending review.

## External AWS prerequisite still missing

Before D-AWS01 can be implemented and production-tested, Chon.Love needs one of:

- a Cognito Identity Pool dedicated to Face Liveness request signing, **or**
- an AWS STS assume-role path with a dedicated least-privilege role for `rekognition:StartFaceLivenessSession` and a short-lived credentials provider.

The current repository/Supabase configuration contains neither a Cognito Identity Pool nor an STS liveness role/credential provider. Implementing the browser component without this prerequisite would require exposing long-lived AWS credentials and is therefore explicitly rejected.

## Release gate

Session D must remain BLOCKED while Face Liveness is still a release requirement. D-FIX01/D-FIX02 may be validated and merged into the repair candidate independently, but Session E must not begin until D-AWS01 is either:

- completed with temporary credentials and real Face Liveness evidence, or
- explicitly superseded in the release contract by an approved product/security decision.
