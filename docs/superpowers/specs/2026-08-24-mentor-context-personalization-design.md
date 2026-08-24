# MentorContext Personalization Design

## Objective

Make stored learner preferences affect every authenticated APPU mentor request through one backend-authoritative `MentorContext`, while preserving authentication, tenancy checks, ACTIVE-subscription gating, usage accounting, guest limits, the live n8n workflow, and the existing voice response path.

## Current State and Gap

The backend already reads a child profile, child personalisation, and resolved entitlements for each authenticated message. It sends that data to n8n under a generic `context` property. The existing object mixes teaching preferences with UI-only presentation fields, while the current live n8n workflow does not consume the object. Consequently, preferences are stored and transported but are not a canonical, verified input to the mentor prompt.

The browser currently supplies `childId`, message text, and an optional language. It is not permitted to supply authoritative preferences, tenant identifiers, subscription state, entitlements, payment data, or secrets.

## Canonical Contracts

Authenticated requests use this flat, discriminated contract:

```ts
interface AuthenticatedMentorContext {
  mode: 'authenticated';
  learnerId: string;
  learnerName: string;
  grade: string;
  primaryLanguage: string;
  learningStyle: LearningStyle;
  responseStyle: ResponseStyle;
  favoriteSubjects: string[];
  interests: string[];
  learningGoals: string[];
  personalizationEnabled: boolean;
  advancedPersonalizationEnabled: boolean;
  longTermContextEnabled: boolean;
}
```

Guests use only:

```ts
interface GuestMentorContext {
  mode: 'guest';
  primaryLanguage: string;
  personalizationEnabled: false;
}
```

`MentorContext` is the union of those two types. The n8n envelope carries it only as `mentorContext`; the ambiguous `context` field is removed to prevent competing formats.

## Field Sources and Exclusions

For authenticated requests, `learnerId`, `learnerName`, and `grade` come from the household-scoped child record. Teaching preferences come from the household-and-child-scoped `child_personalisation` record. The resolved language is the stored preferred language when the server-resolved `multilingual` entitlement is enabled, otherwise `en`. Entitlement flags come from the server entitlement resolver. `personalizationEnabled` means a stored personalisation record exists.

The contract deliberately excludes `favoriteColor`, `fontPreference`, `themePreference`, `voicePreference`, arbitrary `additionalContext`, household and parent data, billing/payment/Razorpay data, bearer tokens, service-role keys, webhook URLs, credentials, and internal security metadata. No database migration is required.

## Authenticated Runtime Flow

1. Verify the bearer token.
2. Resolve the authenticated principal's household membership.
3. Load the requested child with both `householdId` and `childId`.
4. Require an `ACTIVE` subscription.
5. Resolve server-side entitlements and applicable voice allowance.
6. Reserve the AI usage unit using the existing concurrency-safe service.
7. Read the child and personalisation from authoritative storage and build a new `MentorContext` for this request.
8. Send the existing message/session fields plus `mentorContext` to n8n.
9. Commit or release usage according to the existing success/failure rules.
10. Preserve the current text/audio response and voice accounting behavior.

The selected child ID remains part of the idempotency fingerprint and the n8n session ID remains child-specific. A failed ownership, subscription, entitlement, or quota check performs zero n8n calls.

## Preference Updates and Isolation

There is no MentorContext cache. Every authenticated message performs fresh scoped reads. A successful personalisation update therefore affects the next message without logout, reload, server restart, or a new conversation.

Household authorization occurs before personalisation is read. Personalisation repository queries require both `householdId` and `childId`, and the child profile lookup uses the same scope. Two children in one household receive contexts built from their separate rows; a child from another household is indistinguishable from a missing child to the caller.

## Guest Runtime Flow

The existing signed guest session and three-successful-turn limit stay unchanged. After a guest turn reservation, the backend constructs a minimal `GuestMentorContext`. It contains no child ID, learner name, grade, stored preferences, entitlements, household information, or authenticated session data. Turn four and invalid bearer tokens remain blocked before n8n.

## Live n8n Integration

The untracked production export `0-Click Discovery Call Scheduling (Google Meet + WhatsApp) (2).json` is authoritative and remains unmodified. Manual production changes are required in exactly these nodes:

- `Normalize Website Input`: retain the backend's `mentorContext` without deriving or overwriting it.
- `Validate APPU Conversation Envelope`: validate the discriminated shape for website requests while preserving existing input, session, and channel checks.
- `APPU Mentor`: append a verified runtime learner-context block to the end of the existing master system prompt. Do not replace or edit the existing prompt.

WhatsApp continues using its existing `learner_profile` and `profile_name` behavior. For website requests, `mentorContext` is the canonical learner profile. Conversation memory remains separate from authoritative saved preferences.

The current export directly embeds sensitive header values in HTTP request parameters for ElevenLabs and the Meta reply node. Those values must be rotated after exposure and migrated to n8n Credentials or protected environment-backed configuration. The manual runbook must never reproduce their values.

## Error and Compatibility Strategy

The backend continues using its structured application errors and normalized n8n client errors. MentorContext construction adds no browser-visible profile payload. Existing response JSON remains unchanged. The ElevenLabs branch receives the same model response and returns the same audio shape, so no voice redesign is part of this change.

## Verification

Tests must prove authoritative DB construction, UI-only/security-field exclusion, same-household child differentiation, immediate update propagation, forged browser context rejection, cross-household rejection with zero n8n calls, minimal guest context, unchanged guest quota/auth behavior, and exactly-once usage behavior. Full backend and frontend validation plus `git diff --check` is required. A live n8n smoke test is optional and must only run when an explicit safe webhook environment variable is configured.

## Non-goals

No payment changes, authentication redesign, subscription changes, database migration, frontend redesign, voice-personalisation redesign, direct n8n edit, workflow export edit, commit, or push.
