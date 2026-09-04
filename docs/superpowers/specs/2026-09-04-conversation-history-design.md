# APPU Conversation History Design

Date: 2026-09-04
Status: Approved design awaiting implementation-plan review

## Goal

Add persistent, child-scoped recent conversation history to the shared APPU frontend so signed-in learners can start, list, reopen, continue, and delete conversations across the website and native Android app.

## Acceptance criteria

- A signed-in learner can see the latest 30 conversation threads for the active child profile.
- The same history appears on the website and native app after signing into the same household and selecting the same child.
- A learner can start a new conversation, reopen an existing conversation, delete one conversation, or clear all conversations for the active child.
- Reopening a conversation restores its stored text messages and gives APPU the latest eight turns as conversational context.
- Conversation titles are derived deterministically from the first user message without another model call.
- Conversations expire 90 days after their last activity.
- Uploaded image bytes are never stored in conversation history. A message may retain only an attachment-present marker.
- A parent or child can never access another household's or sibling's conversation history unless that exact child profile is active and authorized.
- Guests continue using temporary in-memory UI history only; no guest conversation history API is exposed.
- Existing text, voice, image attachment, quota, billing, request-lifecycle, and WhatsApp behavior remains unchanged.

## Non-goals

- Search, folders, pins, sharing, exports, collaborative conversations, or editable titles.
- Indefinite retention or recovery of expired/deleted conversations.
- Storage of uploaded photos, audio, generated speech, or hidden model reasoning.
- Migrating existing n8n memory into the new history tables.
- Persistent guest history.

## Chosen architecture

PostgreSQL in the existing backend is the canonical history store. The frontend consumes authenticated backend APIs. n8n remains responsible for the mentor response, but the backend supplies the selected conversation's recent context explicitly instead of relying on n8n's process-local `memoryBufferWindow` as durable storage.

Browser-only storage was rejected because it cannot synchronize across devices and can expose a child's chats on shared devices. n8n-only memory was rejected because it does not provide a reliable list, ownership boundary, retention lifecycle, or deletion API.

## Data model

### `conversation_sessions`

- `id uuid primary key`
- `household_id uuid not null references households(id)`
- `child_id uuid not null references child_profiles(id)`
- `title varchar(120) not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `expires_at timestamptz not null`

Indexes:

- `(child_id, updated_at desc)` for recent-list retrieval.
- `(expires_at)` for expiry cleanup.

Deleting a session cascades to its messages. Rows are hard-deleted because the product promises deletion, and no restore feature is in scope.

### `conversation_messages`

- `id uuid primary key`
- `conversation_id uuid not null references conversation_sessions(id) on delete cascade`
- `request_id uuid null references appu_requests(id)`
- `role varchar(16) not null check (role in ('user', 'assistant'))`
- `text text not null`
- `has_image_attachment boolean not null default false`
- `created_at timestamptz not null`

Image Base64, MIME content, audio, access tokens, model internals, and system prompts are not stored.

## Ownership and authorization

All history endpoints require a verified parent bearer token plus a `childId`. The backend resolves the household from the verified token and loads the child through the existing household-scoped repository path. Conversation queries always include both `conversation_sessions.child_id` and `conversation_sessions.household_id`; accepting a client-supplied conversation UUID alone is forbidden.

Switching the active child clears the frontend's loaded conversation state before fetching the newly selected child's list. A missing, deleted, or foreign conversation returns `404`, preventing resource-existence disclosure across tenants.

## API surface

All routes live under the authenticated backend gateway.

### `POST /api/appu/conversations`

Body: `{ childId, firstMessage? }`

Creates an empty conversation. If `firstMessage` is supplied, the title is its normalized first 120 characters. Otherwise the title is `New conversation` until the first successful message updates it.

### `GET /api/appu/conversations?childId=<uuid>`

Returns at most 30 non-expired conversations ordered by `updatedAt desc`. Each item contains only `id`, `title`, `createdAt`, `updatedAt`, and an optional short last-message preview.

### `GET /api/appu/conversations/:conversationId/messages?childId=<uuid>`

Returns ordered stored messages for one owned, non-expired conversation. The initial implementation returns the latest 100 text messages to bound payload size while preserving normal thread use.

### `DELETE /api/appu/conversations/:conversationId?childId=<uuid>`

Hard-deletes one owned conversation and its messages.

### `DELETE /api/appu/conversations?childId=<uuid>`

Hard-deletes all conversations for the owned child.

### Existing `POST /api/appu/message`

Authenticated requests gain required `conversationId` after the frontend creates or selects a conversation. During a compatibility window, authenticated clients that omit it continue the child's most recently active, non-expired conversation, creating one only when none exists. Guest requests remain unchanged and do not receive persisted conversations.

The response includes `conversationId` so the frontend can keep its active thread synchronized.

## Message persistence and mentor context

For an authenticated request, the backend:

1. Verifies parent, household, child, subscription, quota, and conversation ownership.
2. Loads up to the latest eight stored turns for that conversation. One turn means one user message and its assistant response.
3. Sends those messages to n8n as a structured `conversationHistory` field, alongside the current message and existing mentor context.
4. Uses a request-scoped n8n memory key such as `appu_request_<request-id>` for website messages. The explicit backend transcript is the sole durable website context, preventing duplicate turns when n8n's `memoryBufferWindow` also retains state. WhatsApp keeps its existing memory key and behavior.
5. After a successful mentor response, stores the user message and assistant response together in a database transaction, updates `updated_at`, and extends `expires_at` to 90 days from that success.
6. If the mentor request fails, no partial conversation pair is stored. Existing request-lifecycle accounting remains authoritative for retries and uncertain outcomes.
7. Enforces the 30-thread limit whenever a conversation is created by deleting the oldest excess conversations for that child in the same transaction.

The n8n normalization layer labels historical user and assistant text as untrusted conversation content. History cannot override the APPU system prompt, safety rules, tool policy, or current-message priority.

## Title generation

The title is generated without an LLM. The backend collapses whitespace, removes control characters, excludes the image Data URL, and takes the first 120 characters of the first successful user message. Image-only messages use `Homework photo`.

## Retention and cleanup

Every successful message sets `expires_at` to 90 days after `updated_at`. Read queries exclude expired rows immediately. A bounded cleanup operation deletes expired rows in batches. It can run at server startup and from a scheduled maintenance command without affecting request correctness, because expired rows are already hidden by queries.

## Frontend experience

The shared `frontend/` implementation serves both website and Capacitor Android.

- Add a history button to the chat header.
- Opening it shows a recent-conversations panel with up to 30 titles and relative timestamps.
- Desktop uses a panel adjacent to the chat drawer. Mobile/native uses a full-height overlay within the chat surface.
- Selecting a conversation loads its messages into the existing `ChatAgent` renderer and makes it active.
- `New chat` creates and activates an empty conversation.
- Delete-one requires confirmation. `Clear all history` requires a stronger confirmation and affects only the active child.
- The existing trash button clears the active conversation after confirmation; it does not silently clear every thread.
- Stored attachment markers render as `Photo attached`; no broken thumbnail or retained Base64 is shown after reopening.
- Loading, empty, error, and retry states remain inside the history panel.
- When unauthenticated, history controls are hidden and the current guest chat stays in memory until reload/navigation.

## Migration and compatibility

The migration only adds new tables and indexes. It does not modify existing tenancy, subscriptions, usage, guest sessions, request lifecycle, or audio authorization tables.

Backend support is deployed before the frontend starts sending `conversationId`. The compatibility path continues the child's most recently active conversation, or creates one when none exists, allowing staged rollout and older native builds to continue working. Once deployed clients have aged out, requiring `conversationId` can be a separate reviewed change.

Rollback is safe: the frontend can stop displaying history while new tables remain unused. Dropping data is not part of rollback.

## Testing

Backend tests cover:

- household and sibling isolation;
- list ordering, 30-thread pruning, 90-day expiry, and 100-message response bound;
- create, reopen, delete-one, and clear-all routes;
- deterministic title normalization and image-only title;
- transactional user/assistant pair persistence;
- no persistence on failed mentor calls;
- compatibility behavior when `conversationId` is omitted;
- latest-eight-turn n8n envelope context and conversation-scoped session key;
- guest requests never writing conversation rows.

Frontend tests cover:

- authenticated-only history controls;
- list, select, new-chat, delete-one, and clear-all interactions;
- active-child switch clearing stale state;
- rendering stored text and attachment markers without image bytes;
- API payloads carrying the active `conversationId`;
- website and native responsive history layouts.

End-to-end verification covers creating a conversation on the website, continuing it in the Android app under the same child, and confirming that another child cannot see or fetch it.

## Privacy and policy updates

The privacy policy will state that signed-in conversation text is retained for up to 90 days, limited to the latest 30 conversations per child, and deletable by the user. It will state that uploaded image bytes are processed for the response but are not retained in conversation history.
