# MyFan V1 — Product Positioning & Safety Principles

- **Document:** Phase A / Session 1
- **Status:** Approved foundation for V1 implementation
- **Product category:** Social Creator
- **Audience:** Adults aged 18 and over only
- **Last reviewed:** 2026-07-29
- **Applies to:** Mobile app, Admin web, Public web, Store Listing, marketing content, moderation rules, product copy, analytics naming, database naming and API contracts

## 1. Product statement

**MyFan is an 18+ Social Creator network where adults connect with communities, follow Creators and support Creators through digital gifts.**

MyFan enables safe social discovery, friendship-based communication, Creator community building and a transparent virtual-gift economy. User-generated profiles, photos, messages and Fan Album content are subject to platform rules, reporting tools and moderation.

MyFan is not designed to facilitate dating for compensation, sexual arrangements, paid meetings or the purchase of emotional, romantic or sexual access.

### V1 product promise

> Connect safely. Follow Creators. Support creativity with digital gifts. Build trusted Fan communities.

### Store and marketing category

- Primary category: **Social**.
- Minimum age: **18+ only**.
- Store Listing, screenshots, onboarding and advertising must use Social Creator language.
- The product must not be marketed, categorized or optimized as sugar dating, compensated dating, escort, adult entertainment or paid access to relationships.

## 2. Target users

MyFan does not divide users by gender and does not assign financial roles based on gender.

### 2.1 Adults aged 18 and over

Every account holder must be at least 18 years old. Date of birth and an explicit 18+ confirmation are required before the user can access Social features or upload content. Additional age assurance may be required when risk signals, regulation or store policy requires it.

### 2.2 Social users

Adults who want to discover people and communities by province/city and privacy-preserving approximate distance, connect through friendship requests and communicate after friendship acceptance.

### 2.3 Creators

Adults who create compliant content, build a community, receive digital gifts and may apply to the Creator reward program. Eligibility to withdraw Creator earnings requires approved KYC and other risk controls. Creator status never permits prohibited content or paid access to a relationship.

### 2.4 Fans and supporters

Adults who follow and support Creators using digital gifts and may unlock a safe, moderated Fan Album after meeting a configurable support threshold. Fan status grants access to platform-defined community benefits only; it does not create an obligation for the Creator to meet, date, provide sexual content or provide private off-platform access.

## 3. Core value proposition

1. **Community connection:** Adults can discover and connect with people and Creator communities while preserving location privacy.
2. **Follow Creators:** Fans can follow Creators, view approved content and receive community updates.
3. **Digital gifts:** Users can support Creators through a transparent in-app digital-gift system denominated in ❤️.
4. **Creator community building:** Creators can grow a Fan community and receive a platform-funded Creator reward calculated from eligible gifts.
5. **Safe, moderated content:** Public photos, Fan Album media and other UGC are subject to rules, review states, reporting, blocking and enforcement.
6. **Controlled communication:** V1 chat opens only after a friendship request is accepted; unsolicited mass messaging is disabled.
7. **Privacy by default:** Exact location is never exposed to other users. Discovery uses province/city and fuzzed distance bands.

## 4. What MyFan is not

The following product models, content patterns and user promises are excluded from MyFan V1 and from all future releases unless a formal policy, legal and store review explicitly approves a different scope.

### 4.1 Prohibited business or relationship models

MyFan is not:

- Sugar dating or compensated dating.
- A service where money, gifts or financial support are exchanged for dating, romance, affection or a relationship.
- A service where gifts unlock a meeting, date, private encounter or off-platform contact.
- A service where gifts unlock sexual content, nudity, sexually suggestive content or sexual interaction.
- Escort services, prostitution, solicitation of sexual acts or facilitation of commercial sexual services.
- A marketplace for buying attention, emotional access, romantic access or sexual access.
- A system in which one gender pays and another gender receives.
- A peer-to-peer money transfer, remittance or donation app.

### 4.2 Prohibited content and behavior

MyFan does not allow:

- Pornography, sexual services or content intended for sexual gratification.
- Nudity or sexually explicit content.
- Sexually suggestive poses, close-ups or presentation designed primarily to sexualize the subject.
- Requests or offers to exchange gifts, ❤️, money, meetings, dates, contact details or services for sexual or romantic access.
- Advertising escort, massage-with-sexual-services, prostitution, sugar dating or similar arrangements.
- Child sexual abuse and exploitation, grooming, sexualization of minors or any content involving a person under 18.
- Non-consensual intimate imagery, hidden-camera content, sexual deepfakes, threats, sextortion or sexual exploitation.
- Harassment, hate, coercion, stalking, scams, impersonation or financial manipulation.
- Unmoderated public or Fan Album media.
- Exact-location sharing through MyFan discovery features.
- Random or anonymous chat with strangers in V1.

### 4.3 Prohibited product mechanics

The following mechanics must not ship in V1:

- “Pay to message a stranger” or chat without accepted friendship.
- “Gift to meet”, “gift to date” or “gift to get private contact”.
- “Gift to unlock attractive/adult photos”.
- Bulk messaging to strangers.
- Public ranking based on money spent or money received.
- VietQR, bank transfer or an external payment path for purchasing Android in-app digital goods.
- Creator cash-out without KYC, risk checks and manual approval.

## 5. Product principles

These principles are mandatory product requirements, not optional brand guidance.

### P1. 18+ only

- Users under 18 may not register, access, upload or interact.
- Date of birth and explicit age confirmation are required.
- Age-gating must not rely only on copy such as “I am 18+”; the implementation must support stronger controls and review of suspicious accounts.
- MyFan must publish Child Safety Standards and maintain a child-safety point of contact before public release.

### P2. Safety by design

- Safety controls are built into flows rather than added after launch.
- Report, block, moderation state, enforcement history and appeals are part of the core data model.
- High-risk actions such as gifting, KYC and withdrawal must be auditable and rate-limited.

### P3. Privacy by default

- Collect only data necessary for the feature and compliance purpose.
- Public profile fields are separated from private account, KYC, bank and moderation data.
- Private data must not be exposed through public storage URLs, logs or analytics.

### P4. Moderated UGC

- Users must accept Terms of Service and Community Standards before creating or uploading UGC.
- New public and Fan Album media starts in a non-public moderation state, such as `pending_review`.
- MyFan must provide robust, effective and ongoing moderation, including user reporting, user blocking, removal and account enforcement.
- Fan Album content follows the same or stricter content standard as public content.

### P5. No exact-location exposure

- Other users never receive raw latitude/longitude or an exact map pin.
- Discovery may show province/city and a fuzzed distance band only.
- Location fuzzing occurs server-side; the client must not receive exact coordinates for another user.

### P6. No chat before friendship acceptance

- A sender may submit a friendship request and one policy-compliant introduction message if approved by the detailed messaging specification.
- Realtime chat becomes available only after the recipient accepts the friendship.
- A block immediately prevents further friendship and messaging interactions.

### P7. Transparent virtual economy

- Social surfaces display ❤️ rather than VNĐ, except approved purchase and withdrawal screens.
- Digital gifts are in-app items, not direct person-to-person money transfers.
- Prices, confirmation, balance effects and transaction status must be clear before and after gifting.
- Purchase, gift, refund and reward events require immutable records and idempotency.

### P8. Creator reward is separate from user heart balance

- `heart_balance` is purchased for use inside MyFan and cannot be withdrawn.
- `creator_earnings` is a separate reward obligation with pending, available, held, paid and reversed states.
- Creator eligibility, KYC and withdrawal do not convert the user’s purchased heart balance into cash.

### P9. Reporting, blocking and account deletion are mandatory

- Users can report content, profiles and messages from the relevant context.
- Users can block and unblock other users.
- Users can request account deletion inside the app and through a public web route.
- Suspension or deactivation is not a substitute for deletion; lawful retention must be disclosed.

### P10. Neutral roles and non-objectifying language

- Product mechanics do not assume the payer or Creator’s gender.
- UI, data models and analytics use neutral roles: user, Creator, Fan, supporter, sender and recipient.
- Store assets must not portray one gender as purchasing access to another.

### P11. Feature flags for high-risk capabilities

The following remain disabled in V1: stranger messaging, mass messaging, exact map pins, video/live streaming, automatic withdrawals and unreviewed Fan content. A feature flag does not replace policy review; enabling any high-risk feature requires a documented Product, Trust & Safety, Legal/Compliance and Security approval.

### P12. Evidence and auditability

- Enforcement, KYC review, withdrawal review, financial adjustments and Admin actions must produce audit records.
- Administrators may not silently alter balances or moderation history.
- Policy acceptance versions must be recorded.

## 6. Vocabulary standard

The vocabulary below is the source of truth for product copy, code names, analytics events, support macros and Store Listing content.

### 6.1 Approved terms

| Vietnamese UI | English / code concept | Usage |
|---|---|---|
| Creator | Creator | Adult participant who publishes compliant content and may join the reward program. |
| Fan | Fan | Supporter who follows or meets a support threshold for community benefits. |
| Người ủng hộ | Supporter | Neutral description of a user supporting a Creator. |
| Quà tặng số | Digital gift | Internal digital item sent using ❤️. |
| ❤️ | Heart / heart units | In-app virtual value used on Social surfaces. |
| Số dư ❤️ | Heart balance | Purchased in-app balance; not withdrawable. |
| Thu nhập Creator | Creator earnings | Separate reward balance subject to KYC, holding and review. |
| Album Fan | Fan Album | Moderated community album available to eligible Fans. |
| Cộng đồng | Community | Creator and Fan community context. |
| Kết nối | Connect | Social connection; must not imply a paid romantic relationship. |
| Lời mời kết bạn | Friendship request | Required step before V1 chat. |
| Khoảng cách ước tính | Approximate distance | Fuzzed distance band, never exact coordinates. |
| Đang chờ kiểm duyệt | Pending review | Media is not yet visible to other users. |

### 6.2 Prohibited terms and replacements

| Do not use | Use instead | Reason |
|---|---|---|
| Người trả tiền | Người ủng hộ / người gửi quà | Avoids transactional relationship framing. |
| Người bán | Creator | Creators are not selling access to themselves or relationships. |
| Trả tiền để được chú ý | Ủng hộ Creator bằng quà tặng số | Avoids paid emotional access. |
| Tặng quà để hẹn hò | Kết nối cộng đồng / tặng quà số | Compensated-dating risk. |
| Đổi quà lấy ảnh hấp dẫn | Mở quyền lợi cộng đồng / Album Fan đã kiểm duyệt | Removes sexualized quid pro quo. |
| Nam tặng, nữ nhận | Người gửi quà / Creator | Gender-neutral roles are mandatory. |
| Ví tiền | Số dư ❤️ / Thu nhập Creator | Prevents mixing two distinct assets. |
| Rút số dư ❤️ | Rút Thu nhập Creator | Purchased hearts are not withdrawable. |
| Mua quyền gặp Creator | Theo dõi / tham gia cộng đồng Creator | Meetings or relationship access are not sold. |
| Album riêng tư hấp dẫn | Album Fan an toàn, đã kiểm duyệt | Avoids sexualized promotion. |

### 6.3 Copy review rule

Any new copy that connects a gift, ❤️, payment or Creator reward to dating, meeting, affection, sexual content, private contact or an obligation from the recipient must be rejected and escalated to Product and Trust & Safety.

## 7. Google Play risk register

Severity scale:

- **Critical:** Likely rejection/removal, severe user harm or legal exposure.
- **High:** Material policy, fraud or safety risk requiring a launch blocker.
- **Medium:** Important control required, but manageable through standard engineering and operations.

| ID | Risk | Related feature | Severity | Mitigation / launch control | Owner | Status |
|---|---|---|---|---|---|---|
| GP-01 | Compensated dating or sugar-dating interpretation | Discovery, profiles, gifts, Fan benefits, Creator withdrawal, Store Listing | Critical | Social Creator positioning; neutral roles; prohibit gift-for-meeting/relationship/sexual access; review Store assets and sample content; moderation taxonomy for solicitation; no dating filters or paid contact access in V1. | Product + Trust & Safety + Legal/Compliance | **Open — launch blocker** |
| GP-02 | Adult or sexually gratifying content | Public photos, profile bio, Fan Album, chat, Store screenshots | Critical | Prohibit nudity and sexually explicit/suggestive promotion; pre-publication moderation for media; classifier plus human review; report/remove/appeal process; no “adult album” positioning. | Trust & Safety | **Open — launch blocker** |
| GP-03 | Inadequate UGC moderation | Profiles, photos, albums, messages | Critical | Terms acceptance before UGC; reporting and blocking in context; moderation queues, SLAs, repeat-offender enforcement, appeals and audit logs; ongoing staffing and metrics. | Trust & Safety + Engineering | **Planned for V1** |
| GP-04 | Anonymous or random chat risk | Discovery, friendship, chat | High | No random chat; no open stranger chat; chat only after accepted friendship; one controlled introduction at most; rate limits; block/report; future mass messaging disabled. | Product + Engineering | **Mitigated by V1 design** |
| GP-05 | Underage users or weak age gate | Registration, onboarding, discovery, UGC | Critical | 18+ only; DOB and age confirmation; Play Console age-restriction settings where applicable; suspicious-account review; KYC for Creators; published Child Safety Standards; CSAM response process and child-safety contact. | Trust & Safety + Legal/Compliance | **Open — launch blocker** |
| GP-06 | Exact location exposes or enables stalking | Nearby discovery, profile | High | Server-side PostGIS queries; fuzz radius and distance bands; never return another user’s coordinates; permission education; rate limiting and abuse monitoring. | Engineering + Security | **Required for V1** |
| GP-07 | External payment for Android digital goods | Heart purchase, VIP or digital benefits | Critical | Use Google Play Billing for Play-distributed Android digital goods unless an approved market-specific program applies; remove VietQR/external checkout from the Android purchase flow; server-side purchase verification. | Engineering + Finance/Compliance | **Decision approved** |
| GP-08 | Missing or obstructive account deletion | Settings, public web, data retention | High | Discoverable in-app deletion request and public web deletion route; delete associated data subject to disclosed lawful retention; track request status; do not treat deactivation as deletion. | Product + Privacy + Engineering | **Planned for V1** |
| GP-09 | Refund fraud and negative heart liability | Play purchases, heart balance, gifts, Creator rewards | High | Server verification; idempotent purchase processing; refund/revocation handling; immutable ledgers; reverse pending rewards; holds and risk receivables; audit logs; configurable limits. | Finance + Engineering + Risk | **Planned for financial phase** |
| GP-10 | Creator withdrawal fraud | Creator onboarding, KYC, bank account, withdrawal | High | Approved KYC; bank-account review; pending hold period; fraud flags; manual Admin approval; dual control for high value; immutable payout and Admin audit records. | Finance + Risk + Operations | **Planned for V1** |
| GP-11 | Peer-to-peer payment interpretation | Hearts, gifts, Creator reward | High | MyFan sells in-app digital goods; gifts are consumed inside the platform; Creator reward is a separate platform obligation; no user-to-user cash transfer and no withdrawal of purchased hearts. | Product + Finance + Legal/Compliance | **Mitigated by business architecture** |
| GP-12 | Child-safety standards non-compliance | Social category, chat, UGC, support | Critical | Publish standards against CSAE; in-app feedback/reporting; CSAM response and reporting workflow; applicable-law process; named child-safety point of contact; regular operational drills. | Trust & Safety + Legal/Compliance | **Open — launch blocker** |
| GP-13 | Misleading Store Listing or screenshots | Play Store metadata, marketing | High | Store asset checklist; Social Creator language; no sexualized images, gendered payer/receiver framing or gift-for-access claims; reviewer demo account with compliant content. | Product Marketing + Compliance | **Open — pre-submission review** |
| GP-14 | Fan Album becomes paid sexual-content gate | Fan threshold, albums, gifting | Critical | Fan threshold based on community support; content standard equal to or stricter than public media; pre-publication moderation; no nudity/suggestive content; remove quid-pro-quo copy. | Product + Trust & Safety | **Open — launch blocker** |
| GP-15 | Harassment, stalking, scams or coercion | Profiles, friendship, chat, gifts | High | Rate limits, message controls, block/report, scam and solicitation rules, suspicious gift monitoring, enforcement history, emergency escalation and privacy-preserving discovery. | Trust & Safety + Security | **Planned for V1** |

## 8. Product decision checklist

A V1 feature is approved only when all answers below are **Yes**:

- Does the feature reinforce Social Creator positioning rather than dating or paid access?
- Is it restricted to adults and compatible with the 18+ onboarding model?
- Is UGC moderated and reportable where applicable?
- Can a user block another user from the relevant context?
- Does it avoid exposing exact location or sensitive identity data?
- Does it avoid direct or implied gift-for-meeting, gift-for-relationship or gift-for-sexual-content exchange?
- Does it preserve the separation between purchased hearts and Creator earnings?
- Is the feature auditable and reversible when it changes financial or moderation state?
- Is the Store Listing representation consistent with the actual behavior?

Any **No** is a release blocker until Product, Trust & Safety and the relevant technical owner approve a documented mitigation.

## 9. Implementation implications for later phases

This document requires the architecture to support:

- DOB, age-gate acceptance and policy-version acceptance records.
- Profile, media and Fan Album moderation states.
- Contextual report and block actions.
- Friendship state as a prerequisite for chat authorization.
- Server-side location fuzzing and no exact-coordinate response to other users.
- Separate heart and Creator-reward ledgers.
- KYC, bank review, hold and manual withdrawal approval.
- Admin moderation queues, reports, appeals and immutable audit logs.
- Public Terms, Privacy, Community Standards, Child Safety Standards and account-deletion pages.
- Feature flags defaulted off for stranger messaging, bulk messaging, exact map pins, video/live, automatic payouts and unreviewed Fan content.

## 10. Source references

Product and engineering teams must re-check current policy before each Play submission. The following official references were reviewed on 2026-07-29:

1. [Google Play — Inappropriate Content](https://support.google.com/googleplay/android-developer/answer/9878810?hl=en)
2. [Google Play — User Generated Content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
3. [Google Play — Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en)
4. [Google Play — Age-Restricted Content and Functionality](https://support.google.com/googleplay/android-developer/answer/16302250?hl=en)
5. [Google Play — Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
6. [Google Play — App account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

## 11. Acceptance criteria verification

- [x] Product statement clearly defines MyFan as an 18+ Social Creator network.
- [x] No product language positions MyFan as dating for compensation.
- [x] Prohibited business models, content and mechanics are explicit.
- [x] 18+ and child-safety principles are explicit.
- [x] Google Play risk register includes required risks, ownership and status.
- [x] Approved and prohibited vocabulary is defined for the entire project.
- [x] Exact location, pre-friendship chat, UGC moderation, reporting, blocking and deletion requirements are explicit.
- [x] Heart balance and Creator earnings are defined as separate concepts.

---

**Decision:** This positioning is the mandatory baseline for MyFan V1. Any conflicting UI prototype copy, sample data, business rule, marketing asset or future feature must be changed to comply with this document before release.
