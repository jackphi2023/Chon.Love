# Phase C / Session 18 — Friendship-gated realtime chat

**Status:** Draft implementation on PR #8; automated CI and multi-account device QA are required before merge.

## Scope

Session 18 delivers text-only realtime chat for Android and Expo Web after an accepted friendship.

Included:

- Conversation list with unread count and safe preview.
- Direct conversation detail.
- Exact-conversation Supabase Realtime subscription.
- Message history keyset pagination.
- Optimistic text send with retry and rollback state.
- Server idempotency through `sender_id + client_message_id`.
- Read state.
- Message reporting.
- Local-only hide.
- Block/unblock from chat.
- Per-conversation seven-day physical message deletion.

Not included:

- Image/file/video messages.
- Voice/video calls.
- Stranger messaging.
- Mass messaging.
- Client-created gift messages.
- Push notifications.

## Friendship and block authorization

A message insert is accepted only when:

1. The sender is authenticated and remains an active adult account.
2. The sender is a member of the exact conversation.
3. The conversation belongs to an accepted friendship.
4. Neither participant has blocked the other.
5. The recipient remains an active adult account.

The database trigger remains a final enforcement layer in addition to the hardened `send_message` RPC.

## Pagination

- Default history page: 40 messages.
- Maximum history page: 50 messages.
- Cursor: `(sent_at, id)`.
- Messages are returned newest first.
- The client does not load the full history at once.

## Idempotency and optimistic UI

Each client send generates a UUID `client_message_id`.

The unique constraint is:

```text
(sender_id, client_message_id)
```

A retry with the same conversation and body returns the existing row. Reuse with different content is rejected as `client_message_id_conflict`.

Realtime and optimistic rows are deduplicated by:

```text
sender_id + client_message_id
```

## Rate limits

Configured in `private.app_config`:

```text
8 messages / 10 seconds
120 messages / 5 minutes
2,000 characters / text message
```

The rate-limit configuration is private. Character and page-size configuration may be read through safe RPC results.

## Realtime

The client subscribes only to:

```text
messages where conversation_id = the opened conversation
conversations where id = the opened conversation
```

It never subscribes to all messages.

The channel is removed when leaving the screen. Reconnect invalidates only the current conversation history, retention setting and conversation-list cache.

## Seven-day physical deletion

Each conversation has one shared setting:

```text
auto_delete_messages_after_days = null | 7
```

Either participant may toggle it from that conversation. The setting applies to both participants.

### When enabled

- Messages reaching seven days are physically deleted from `public.messages`.
- The server purge runs every five minutes through `pg_cron`.
- Messages already at least seven days old are deleted immediately when enabling.
- The current screen also removes expired rows at the exact local deadline and refetches the server.
- Realtime `DELETE` removes the row from both open clients.
- Deleted messages cannot be restored.
- No message body snapshot is created by the retention feature.
- A report whose only target is that message is deleted through `ON DELETE CASCADE`, so the report cannot retain or block the expired message.
- Per-user hide records are removed by cascade.
- Read pointers are cleared by the existing `ON DELETE SET NULL` foreign key.

### When disabled

- Remaining messages stop expiring automatically.
- Messages already deleted from the server cannot be restored.

### Server job

```text
job name: myfan-purge-ephemeral-chat
schedule: */5 * * * *
command: select private.purge_expired_conversation_messages();
```

The purge function is executable only by `service_role`/database infrastructure, not by authenticated clients.

## Storage and privacy

Chat is text-only in this session. No chat media bucket or public URL is introduced.

The client never receives:

- Another user’s email.
- DOB.
- Exact location.
- KYC/bank data.
- Internal moderation data.
- Service-role credentials.

## Database objects

Migrations:

```text
20260730071716_phase_c_18_friendship_gated_realtime_chat.sql
20260730073359_phase_c_18_ephemeral_chat_retention.sql
20260730073459_phase_c_18_ephemeral_chat_realtime_sync.sql
```

Client RPCs:

```text
get_direct_conversation
get_conversation_detail
list_my_conversations
list_conversation_messages
send_message
mark_conversation_read
hide_message_for_me
get_conversation_retention
set_conversation_auto_delete
```

Private server function:

```text
private.purge_expired_conversation_messages
```

## Rollback guidance

Use forward migrations rather than editing applied migration history.

A safe rollback may:

1. Unschedule `myfan-purge-ephemeral-chat`.
2. Set all `auto_delete_messages_after_days` values to `null`.
3. Revoke the two retention RPCs.
4. Leave the retention columns in place to avoid destructive schema rollback.
5. Restore the reports foreign key only after deciding how reports should behave when a message is deleted.

Messages already physically deleted cannot be restored by a database migration unless an external backup exists. No such restoration path is promised by this feature.

## QA still required

- Two real accounts accept a friendship and chat on separate devices.
- Reconnect and duplicate-delivery testing under unstable mobile networks.
- Toggle retention from both participants simultaneously.
- Confirm immediate deletion of test messages older than seven days.
- Confirm cron deletion and conversation preview refresh.
- Confirm reports cascade when their message expires.
- Android physical-device keyboard/composer behavior.
- Chrome/Safari mobile-web behavior.
