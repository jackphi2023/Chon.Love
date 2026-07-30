# Phase C / Session 18 — Friendship-gated realtime chat

**Status:** Draft implementation on PR #8; automated CI and multi-account device QA are required before merge.

## Scope

Session 18 delivers text-only realtime chat for Android and Expo Web after an accepted friendship.

Included:

- Conversation list with unread count and safe preview.
- Direct conversation detail.
- Chat entry from an accepted friend profile and the Connections tab.
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

## Idempotency and rate limits

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

Sending is serialized per sender with a transaction advisory lock, preventing concurrent requests from bypassing the rate counters.

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
conversation_members where conversation_id = the opened conversation
conversations where id = the opened conversation
```

It never subscribes to all messages.

Realtime covers:

- New and moderated message rows.
- Physical message deletion.
- Read-receipt changes.
- Seven-day retention-setting changes made by the other participant.

The channel is removed when leaving the screen. Stable query keys prevent unnecessary reconnects. Reconnect invalidates only the current conversation history, retention setting and conversation-list cache.

## Seven-day physical deletion

Each conversation has one shared setting:

```text
auto_delete_messages_after_days = null | 7
```

Either participant may toggle it from that conversation. The setting applies to both participants and is synchronized to both open clients.

### When enabled

- Messages reaching seven days stop being readable at the exact server-side boundary through RPC and RLS filters.
- The open client removes the row at the exact local deadline and refetches the server.
- A server `pg_cron` job physically deletes expired rows every minute.
- Each purge transaction processes at most 5,000 rows using `SKIP LOCKED` to reduce long locks.
- Messages already at least seven days old are physically deleted immediately when enabling.
- Realtime `DELETE` removes the row from both open clients.
- Deleted messages cannot be restored through the application.
- No application-level message body snapshot or archive is created.
- A report whose target is that message is deleted through `ON DELETE CASCADE`, so a report cannot retain or block the expired message.
- Per-user hide records are removed by cascade.
- Read pointers are cleared by the existing `ON DELETE SET NULL` foreign key.

### When disabled

- Remaining messages stop expiring automatically.
- Messages already deleted from the live database cannot be restored by this feature.

### Server job

```text
job name: myfan-purge-ephemeral-chat
schedule: * * * * *
command: select private.purge_expired_conversation_messages();
```

The purge function is executable only by database infrastructure/service role, not by authenticated clients. Cron run history was verified as `succeeded` repeatedly on the development project.

### Managed-backup boundary

The feature deletes the live database row and all application references described above. It does not create an application archive. Supabase-managed backups or point-in-time recovery, if enabled for the project, are infrastructure retention mechanisms outside this application migration and must be reviewed separately before making an absolute regulatory promise that no historical backup can contain an earlier row.

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
20260730074758_phase_c_18_chat_rls_helper_execution.sql
20260730075557_phase_c_18_ephemeral_chat_read_barrier.sql
20260730080834_phase_c_18_retention_actor_index.sql
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

## Advisor review

Security Advisor reports the project-wide expected warning category for authenticated `SECURITY DEFINER` gateway RPCs. Session 18 RPCs were explicitly verified to:

- Require `auth.uid()` and an active adult account.
- Validate exact conversation membership.
- Use a fixed empty `search_path`.
- Reject `anon` and `PUBLIC` execution.

The private `message_user_hides` table intentionally has RLS enabled with no direct policies; clients access it only through validated RPCs and a private RLS helper.

Performance Advisor's new unindexed retention-actor foreign key notice was resolved by `conversations_message_retention_updated_by_idx`. Development-only `unused_index` notices are expected while the database contains no conversation/message fixtures.

Advisor references:

- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Rollback guidance

Use forward migrations rather than editing applied migration history.

A safe rollback may:

1. Unschedule `myfan-purge-ephemeral-chat`.
2. Set all `auto_delete_messages_after_days` values to `null`.
3. Revoke the two retention RPCs.
4. Leave the retention columns in place to avoid destructive schema rollback.
5. Restore the reports foreign key only after deciding how reports should behave when a message is deleted.

Messages already physically deleted cannot be restored by an application migration unless an external infrastructure backup exists. No restoration path is promised by this feature.

## QA still required

- Two real accounts accept a friendship and chat on separate devices.
- Reconnect and duplicate-delivery testing under unstable mobile networks.
- Toggle retention from both participants simultaneously.
- Confirm immediate deletion of test messages older than seven days.
- Confirm cron deletion, exact read barrier and conversation preview refresh.
- Confirm reports cascade when their message expires.
- Android physical-device keyboard/composer behavior.
- Chrome/Safari mobile-web behavior.
- Review Supabase backup/PITR retention before publishing absolute deletion language externally.
