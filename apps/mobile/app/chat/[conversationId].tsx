import {
  blockUser,
  createChatClientMessageId,
  createSafetyReport,
  filterExpiredChatMessages,
  getConversationDetail,
  getConversationRetention,
  getNextChatExpiryMs,
  getOlderMessageCursor,
  getReadableChatError,
  getReadableSocialError,
  hideMessageForMe,
  listConversationMessages,
  markConversationRead,
  mergeChatMessagesNewestFirst,
  REPORT_REASON_OPTIONS,
  sendChatMessage,
  setConversationAutoDelete,
  subscribeToConversationMessages,
  unblockUser,
  unsubscribeFromConversation,
  type ChatMessage,
  type ChatMessageCursor,
  type ChatRealtimeStatus,
  type ConversationRetention,
  type ReportReasonCode,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type DeliveryState = 'sent' | 'sending' | 'failed';
type RenderMessage = ChatMessage & { delivery: DeliveryState };

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function realtimeLabel(status: ChatRealtimeStatus): string {
  if (status === 'connected') return 'Đã kết nối';
  if (status === 'connecting') return 'Đang kết nối…';
  if (status === 'reconnecting') return 'Đang kết nối lại…';
  if (status === 'error') return 'Kết nối gián đoạn';
  return 'Đã ngắt kết nối';
}

function confirmCrossPlatform(input: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (Platform.OS === 'web') {
    const confirmFunction = (globalThis as typeof globalThis & { confirm?: (message: string) => boolean }).confirm;
    if (confirmFunction?.(`${input.title}\n\n${input.message}`)) input.onConfirm();
    return;
  }

  Alert.alert(input.title, input.message, [
    { text: 'Hủy', style: 'cancel' },
    {
      text: input.confirmLabel,
      style: input.destructive ? 'destructive' : 'default',
      onPress: input.onConfirm,
    },
  ]);
}

export default function ChatDetailPage() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = normalizeParam(params.conversationId);
  const router = useRouter();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();

  const [composer, setComposer] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<RenderMessage[]>([]);
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<ChatRealtimeStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [expiryClock, setExpiryClock] = useState(() => Date.now());
  const [reportMessage, setReportMessage] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState<ReportReasonCode>('spam');
  const [reportDescription, setReportDescription] = useState('');
  const lastMarkedMessageId = useRef<string | null>(null);

  const detailQueryKey = useMemo(
    () => ['chat', 'detail', auth.userId, conversationId] as const,
    [auth.userId, conversationId],
  );
  const retentionQueryKey = useMemo(
    () => ['chat', 'retention', auth.userId, conversationId] as const,
    [auth.userId, conversationId],
  );
  const messagesQueryKey = useMemo(
    () => ['chat', 'messages', auth.userId, conversationId] as const,
    [auth.userId, conversationId],
  );

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    enabled: Boolean(client && auth.userId && conversationId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getConversationDetail(client, conversationId);
    },
  });

  const retentionQuery = useQuery({
    queryKey: retentionQueryKey,
    enabled: Boolean(client && auth.userId && conversationId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getConversationRetention(client, conversationId);
    },
  });

  const pageSize = detailQuery.data?.page_size ?? 40;
  const pagedMessagesQueryKey = useMemo(
    () => [...messagesQueryKey, pageSize] as const,
    [messagesQueryKey, pageSize],
  );
  const messagesQuery = useInfiniteQuery({
    queryKey: pagedMessagesQueryKey,
    enabled: Boolean(client && auth.userId && conversationId && detailQuery.data),
    initialPageParam: null as ChatMessageCursor | null,
    refetchOnWindowFocus: false,
    queryFn: async ({ pageParam }) => {
      if (!client) throw new Error('supabase_not_configured');
      return listConversationMessages(client, {
        conversationId,
        limit: pageSize,
        before: pageParam,
      });
    },
    getNextPageParam: (lastPage) => getOlderMessageCursor(lastPage, pageSize),
  });

  const stableMessages = useMemo(
    () => mergeChatMessagesNewestFirst([
      ...realtimeMessages,
      ...(messagesQuery.data?.pages.flat() ?? []),
    ]),
    [messagesQuery.data?.pages, realtimeMessages],
  );

  const visibleStableMessages = useMemo(
    () => filterExpiredChatMessages(stableMessages, retentionQuery.data, expiryClock),
    [expiryClock, retentionQuery.data, stableMessages],
  );

  const renderMessages = useMemo<RenderMessage[]>(() => {
    const delivered = new Set(
      visibleStableMessages.map((item) => `${item.sender_id}:${item.client_message_id}`),
    );
    return [
      ...optimisticMessages.filter((item) => !delivered.has(`${item.sender_id}:${item.client_message_id}`)),
      ...visibleStableMessages.map((item) => ({ ...item, delivery: 'sent' as const })),
    ].sort((a, b) => b.sent_at.localeCompare(a.sent_at) || b.id.localeCompare(a.id));
  }, [optimisticMessages, visibleStableMessages]);

  useEffect(() => {
    const nextExpiry = getNextChatExpiryMs(stableMessages, retentionQuery.data, Date.now());
    if (nextExpiry === null) return;
    const maxTimeout = 2_147_000_000;
    const delay = Math.max(250, Math.min(nextExpiry - Date.now() + 100, maxTimeout));
    const timer = setTimeout(() => {
      setExpiryClock(Date.now());
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] });
    }, delay);
    return () => clearTimeout(timer);
  }, [auth.userId, messagesQueryKey, queryClient, retentionQuery.data, stableMessages]);

  useEffect(() => {
    if (!client || !auth.userId || !conversationId) return;
    let active = true;
    const channel = subscribeToConversationMessages(client, {
      conversationId,
      viewerUserId: auth.userId,
      onMessage: (incoming) => {
        if (!active) return;
        setOptimisticMessages((current) =>
          current.filter((item) => item.client_message_id !== incoming.client_message_id),
        );
        setRealtimeMessages((current) => mergeChatMessagesNewestFirst([incoming, ...current]));
        void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] });
      },
      onDelete: (messageId) => {
        if (!active) return;
        setRealtimeMessages((current) => current.filter((item) => item.id !== messageId));
        setOptimisticMessages((current) => current.filter((item) => item.id !== messageId));
        void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
        void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] });
      },
      onReadChange: () => {
        if (!active) return;
        void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      },
      onRetentionChange: (retention) => {
        if (!active) return;
        const current = queryClient.getQueryData<ConversationRetention>(retentionQueryKey);
        if (
          current?.auto_delete_enabled === retention.auto_delete_enabled &&
          current.auto_delete_after_days === retention.auto_delete_after_days &&
          current.updated_at === retention.updated_at
        ) {
          return;
        }
        queryClient.setQueryData<ConversationRetention>(retentionQueryKey, retention);
        setExpiryClock(Date.now());
        void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
        void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] });
      },
      onStatus: (status) => {
        if (!active) return;
        setRealtimeStatus(status);
        if (status === 'connected') {
          void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
          void queryClient.invalidateQueries({ queryKey: retentionQueryKey });
        }
      },
    });
    return () => {
      active = false;
      void unsubscribeFromConversation(client, channel);
    };
  }, [auth.userId, client, conversationId, messagesQueryKey, queryClient, retentionQueryKey]);

  useEffect(() => {
    const latest = visibleStableMessages.find((item) => !item.removed);
    if (!client || !latest || lastMarkedMessageId.current === latest.id) return;
    lastMarkedMessageId.current = latest.id;
    void markConversationRead(client, conversationId, latest.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] }))
      .catch(() => {
        lastMarkedMessageId.current = null;
      });
  }, [auth.userId, client, conversationId, queryClient, visibleStableMessages]);

  async function send(body: string, clientMessageId = createChatClientMessageId()) {
    if (!client || !auth.userId || !detailQuery.data?.can_send) return;
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > detailQuery.data.message_max_characters) {
      setErrorMessage(getReadableChatError(new Error('invalid_message_body')));
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    const optimistic: RenderMessage = {
      id: clientMessageId,
      conversation_id: conversationId,
      sender_id: auth.userId,
      message_type: 'text',
      body: trimmed,
      gift_transaction_id: null,
      client_message_id: clientMessageId,
      sent_at: new Date().toISOString(),
      edited_at: null,
      removed: false,
      is_own: true,
      is_read_by_other: false,
      delivery: 'sending',
    };

    setOptimisticMessages((current) => [
      optimistic,
      ...current.filter((item) => item.client_message_id !== clientMessageId),
    ]);
    setComposer('');

    try {
      const sent = await sendChatMessage(client, {
        conversationId,
        body: trimmed,
        clientMessageId,
      });
      setOptimisticMessages((current) =>
        current.filter((item) => item.client_message_id !== clientMessageId),
      );
      setRealtimeMessages((current) => mergeChatMessagesNewestFirst([sent, ...current]));
      await queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] });
    } catch (error) {
      setOptimisticMessages((current) => current.map((item) =>
        item.client_message_id === clientMessageId ? { ...item, delivery: 'failed' } : item,
      ));
      setErrorMessage(getReadableChatError(error));
    }
  }

  async function handleRetentionChange(enabled: boolean) {
    if (!client) return;
    setRetentionBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await setConversationAutoDelete(client, conversationId, enabled);
      queryClient.setQueryData<ConversationRetention>(retentionQueryKey, {
        conversation_id: result.conversation_id,
        auto_delete_enabled: result.auto_delete_enabled,
        auto_delete_after_days: result.auto_delete_after_days,
        updated_at: result.updated_at,
      });
      setExpiryClock(Date.now());
      setRealtimeMessages((current) => filterExpiredChatMessages(current, result, Date.now()));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: messagesQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] }),
      ]);
      if (enabled) {
        setSuccessMessage(
          result.deleted_messages > 0
            ? `Đã bật tự động xóa sau 7 ngày và xóa ${result.deleted_messages} tin đã quá hạn khỏi server cho cả hai bên.`
            : 'Đã bật tự động xóa sau 7 ngày cho cả hai bên.',
        );
      } else {
        setSuccessMessage('Đã tắt tự động xóa. Tin đã bị xóa trước đó không thể khôi phục.');
      }
    } catch (error) {
      setErrorMessage(getReadableChatError(error));
    } finally {
      setRetentionBusy(false);
    }
  }

  function confirmRetentionChange(enabled: boolean) {
    confirmCrossPlatform({
      title: enabled ? 'Bật tự động xóa sau 7 ngày?' : 'Tắt tự động xóa?',
      message: enabled
        ? 'Cài đặt áp dụng cho cả hai người. Tin nhắn đủ 7 ngày sẽ bị xóa vật lý khỏi server và không thể khôi phục. Tin đã quá 7 ngày sẽ bị xóa ngay khi bật.'
        : 'Các tin còn lại sẽ được giữ cho đến khi bị ẩn, kiểm duyệt hoặc cài đặt này được bật lại. Tin đã xóa khỏi server không thể khôi phục.',
      confirmLabel: enabled ? 'Bật' : 'Tắt',
      destructive: !enabled,
      onConfirm: () => void handleRetentionChange(enabled),
    });
  }

  async function handleHide(message: ChatMessage) {
    if (!client) return;
    try {
      await hideMessageForMe(client, message.id);
      setRealtimeMessages((current) => current.filter((item) => item.id !== message.id));
      await queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      setSuccessMessage('Tin nhắn đã được ẩn khỏi tài khoản của bạn.');
    } catch (error) {
      setErrorMessage(getReadableChatError(error));
    }
  }

  function confirmHide(message: ChatMessage) {
    confirmCrossPlatform({
      title: 'Ẩn tin nhắn?',
      message: 'Tin nhắn chỉ bị ẩn khỏi tài khoản của bạn và không bị xóa khỏi tài khoản người còn lại.',
      confirmLabel: 'Ẩn',
      destructive: true,
      onConfirm: () => void handleHide(message),
    });
  }

  async function handleReport() {
    if (!client || !reportMessage) return;
    setSafetyBusy(true);
    setErrorMessage(null);
    try {
      await createSafetyReport(client, {
        targetMessageId: reportMessage.id,
        reasonCode: reportReason,
        description: reportDescription,
      });
      setReportMessage(null);
      setReportReason('spam');
      setReportDescription('');
      setSuccessMessage('Báo cáo tin nhắn đã được gửi tới đội ngũ an toàn MyFan.');
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setSafetyBusy(false);
    }
  }

  async function toggleBlock() {
    if (!client || !detailQuery.data) return;
    setSafetyBusy(true);
    setErrorMessage(null);
    try {
      if (detailQuery.data.blocked_by_viewer) {
        await unblockUser(client, detailQuery.data.other_user_id);
        setSuccessMessage('Đã bỏ chặn tài khoản. Quan hệ bạn bè cũ không được tự động khôi phục.');
      } else {
        await blockUser(client, detailQuery.data.other_user_id, 'chat_safety');
        setSuccessMessage('Đã chặn tài khoản và ngắt khả năng gửi tin.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', auth.userId] }),
        queryClient.invalidateQueries({ queryKey: ['social-connections', auth.userId] }),
      ]);
    } catch (error) {
      setErrorMessage(getReadableSocialError(error));
    } finally {
      setSafetyBusy(false);
    }
  }

  function confirmBlock() {
    const detail = detailQuery.data;
    if (!detail) return;
    if (detail.blocked_by_viewer) {
      void toggleBlock();
      return;
    }
    confirmCrossPlatform({
      title: 'Chặn tài khoản này?',
      message: 'Hai tài khoản sẽ không thể kết bạn, nhắn tin, tặng quà hoặc xem Album Fan của nhau.',
      confirmLabel: 'Chặn',
      destructive: true,
      onConfirm: () => void toggleBlock(),
    });
  }

  if (detailQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.muted}>Đang tải…</Text>
      </View>
    );
  }

  const detail = detailQuery.data;
  if (!conversationId || !detail || detailQuery.error) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="header" style={styles.notFoundTitle}>Không thể mở cuộc trò chuyện</Text>
        <Text style={styles.muted}>Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const displayName = detail.display_name || detail.username || 'Thành viên MyFan';
  const composerDisabled = !detail.can_send || safetyBusy;
  const retentionEnabled = retentionQuery.data?.auto_delete_enabled ?? false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!detail.username || detail.blocked_by_other}
            onPress={() => detail.username && router.push({ pathname: '/profile/[username]', params: { username: detail.username } })}
            style={styles.headerIdentity}
          >
            <SocialAvatar
              mediaId={detail.avatar_media_id}
              name={displayName}
              storageBucket={detail.avatar_storage_bucket}
              storagePath={detail.avatar_storage_path}
            />
            <View style={styles.headerText}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
                {detail.is_creator ? <Text style={styles.creatorBadge}>Creator</Text> : null}
              </View>
              <Text style={[styles.connection, realtimeStatus === 'error' && styles.errorText]}>
                {realtimeLabel(realtimeStatus)}
              </Text>
            </View>
          </Pressable>
          {!detail.blocked_by_other ? (
            <Pressable accessibilityRole="button" disabled={safetyBusy} onPress={confirmBlock} style={styles.headerAction}>
              <Text style={detail.blocked_by_viewer ? styles.primaryActionText : styles.dangerActionText}>
                {detail.blocked_by_viewer ? 'Bỏ chặn' : 'Chặn'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.retentionCard}>
          <View style={styles.retentionCopy}>
            <Text style={styles.retentionTitle}>Tự động xóa tin nhắn sau 7 ngày</Text>
            <Text style={styles.retentionDescription}>
              {retentionEnabled
                ? 'Đang bật cho cả hai người. Tin đủ 7 ngày bị xóa khỏi server và không thể khôi phục.'
                : 'Đang tắt. Bật riêng cho hội thoại này nếu hai bạn muốn tin được xóa khỏi server sau 7 ngày.'}
            </Text>
          </View>
          {retentionQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              accessibilityLabel="Tự động xóa tin nhắn sau 7 ngày cho cả hai người"
              disabled={retentionBusy || Boolean(retentionQuery.error)}
              onValueChange={confirmRetentionChange}
              value={retentionEnabled}
            />
          )}
        </View>

        {successMessage ? <Text accessibilityRole="alert" style={styles.success}>{successMessage}</Text> : null}
        {errorMessage || retentionQuery.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage ?? 'Không thể tải cài đặt tự động xóa. Hãy thử lại.'}
          </Text>
        ) : null}

        <FlatList
          contentContainerStyle={styles.messageList}
          data={renderMessages}
          inverted
          keyExtractor={(item) => `${item.sender_id}:${item.client_message_id}`}
          ListEmptyComponent={
            messagesQuery.isLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>Đang tải…</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Bắt đầu cuộc trò chuyện</Text>
                <Text style={styles.muted}>Chỉ gửi nội dung phù hợp với Tiêu chuẩn cộng đồng MyFan.</Text>
              </View>
            )
          }
          ListFooterComponent={
            messagesQuery.isFetchingNextPage ? (
              <View style={styles.loadOlder}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>Đang tải tin cũ…</Text>
              </View>
            ) : null
          }
          onEndReached={() => {
            if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
              void messagesQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.35}
          renderItem={({ item }) => (
            <MessageBubble
              item={item}
              onHide={() => confirmHide(item)}
              onReport={item.is_own ? undefined : () => setReportMessage(item)}
              onRetry={item.delivery === 'failed' ? () => void send(item.body ?? '', item.client_message_id) : undefined}
            />
          )}
        />

        {detail.can_send ? (
          <View style={styles.composerArea}>
            <TextInput
              accessibilityLabel="Nội dung tin nhắn"
              maxLength={detail.message_max_characters}
              multiline
              onChangeText={setComposer}
              placeholder="Nhập tin nhắn…"
              style={styles.composer}
              value={composer}
            />
            <View style={styles.composerFooter}>
              <Text style={styles.counter}>{composer.length}/{detail.message_max_characters}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={composerDisabled || !composer.trim()}
                onPress={() => void send(composer)}
                style={[styles.sendButton, (composerDisabled || !composer.trim()) && styles.disabled]}
              >
                <Text style={styles.sendText}>Gửi</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.disabledComposer}>
            <Text style={styles.disabledComposerTitle}>Không thể gửi tin nhắn</Text>
            <Text style={styles.muted}>
              {detail.blocked_by_viewer || detail.blocked_by_other
                ? 'Một trong hai tài khoản đã chặn người kia.'
                : 'Chat chỉ hoạt động khi hai tài khoản vẫn là bạn bè và đang hoạt động.'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <ReportMessageModal
        busy={safetyBusy}
        description={reportDescription}
        onClose={() => setReportMessage(null)}
        onDescriptionChange={setReportDescription}
        onReasonChange={setReportReason}
        onSubmit={() => void handleReport()}
        reason={reportReason}
        visible={Boolean(reportMessage)}
      />
    </SafeAreaView>
  );
}

function MessageBubble({
  item,
  onHide,
  onReport,
  onRetry,
}: {
  item: RenderMessage;
  onHide: () => void;
  onReport?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
}) {
  const body = item.removed
    ? 'Tin nhắn không còn hiển thị.'
    : item.message_type === 'gift'
      ? 'Đã gửi một món quà.'
      : item.message_type === 'system'
        ? item.body || 'Thông báo hệ thống.'
        : item.body || 'Tin nhắn không còn hiển thị.';

  return (
    <View style={[styles.messageRow, item.is_own ? styles.messageRowOwn : styles.messageRowOther]}>
      <View style={[styles.bubble, item.is_own ? styles.ownBubble : styles.otherBubble]}>
        <Text style={[styles.messageBody, item.is_own && styles.ownMessageBody]}>{body}</Text>
        <View style={styles.messageMeta}>
          <Text style={[styles.messageTime, item.is_own && styles.ownMessageMeta]}>{formatTime(item.sent_at)}</Text>
          {item.delivery === 'sending' ? <Text style={[styles.messageTime, styles.ownMessageMeta]}>Đang gửi…</Text> : null}
          {item.delivery === 'failed' ? <Text style={styles.failedText}>Gửi lỗi</Text> : null}
          {item.delivery === 'sent' && item.is_own ? (
            <Text style={[styles.messageTime, styles.ownMessageMeta]}>{item.is_read_by_other ? 'Đã xem' : 'Đã gửi'}</Text>
          ) : null}
        </View>
        <View style={styles.messageActions}>
          <Pressable accessibilityRole="button" onPress={onHide}>
            <Text style={[styles.messageActionText, item.is_own && styles.ownMessageMeta]}>Ẩn</Text>
          </Pressable>
          {onReport ? (
            <Pressable accessibilityRole="button" onPress={onReport}>
              <Text style={styles.messageActionText}>Báo cáo</Text>
            </Pressable>
          ) : null}
          {onRetry ? (
            <Pressable accessibilityRole="button" onPress={onRetry}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ReportMessageModal(props: {
  visible: boolean;
  busy: boolean;
  reason: ReportReasonCode;
  description: string;
  onReasonChange: (reason: ReportReasonCode) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={props.onClose} transparent visible={props.visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text accessibilityRole="header" style={styles.modalTitle}>Báo cáo tin nhắn</Text>
          <Text style={styles.muted}>Chọn lý do chính. Mô tả bổ sung là tùy chọn.</Text>
          <View style={styles.reasonRow}>
            {REPORT_REASON_OPTIONS.map((reason) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: props.reason === reason.code }}
                key={reason.code}
                onPress={() => props.onReasonChange(reason.code)}
                style={[styles.reasonChip, props.reason === reason.code && styles.reasonChipActive]}
              >
                <Text style={[styles.reasonText, props.reason === reason.code && styles.reasonTextActive]}>{reason.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Mô tả bổ sung cho báo cáo tin nhắn"
            maxLength={1000}
            multiline
            onChangeText={props.onDescriptionChange}
            placeholder="Mô tả ngắn sự việc"
            style={styles.reportInput}
            value={props.description}
          />
          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Hủy</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onSubmit} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{props.busy ? 'Đang gửi…' : 'Gửi báo cáo'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  notFoundTitle: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  backButton: { width: 40, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.primary, fontSize: 32, lineHeight: 34, fontWeight: '700' },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '900' },
  creatorBadge: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  connection: { color: '#166534', fontSize: 11, fontWeight: '700' },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  primaryActionText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  dangerActionText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  errorText: { color: colors.danger },
  retentionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#FFFBEB', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  retentionCopy: { flex: 1, gap: 2 },
  retentionTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  retentionDescription: { color: '#92400E', fontSize: 11, lineHeight: 16 },
  success: { color: '#166534', fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  messageList: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  emptyState: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl, transform: [{ scaleY: -1 }] },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  loadOlder: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, transform: [{ scaleY: -1 }] },
  messageRow: { width: '100%', marginVertical: 5 },
  messageRowOwn: { alignItems: 'flex-end' },
  messageRowOther: { alignItems: 'flex-start' },
  bubble: { maxWidth: '84%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 5 },
  ownBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  otherBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 5 },
  messageBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
  ownMessageBody: { color: '#FFFFFF' },
  messageMeta: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 7 },
  messageTime: { color: colors.muted, fontSize: 10 },
  ownMessageMeta: { color: '#FCE7F3' },
  failedText: { color: '#FEE2E2', fontSize: 10, fontWeight: '900' },
  messageActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 2 },
  messageActionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  retryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  composerArea: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  composer: { minHeight: 48, maxHeight: 132, borderWidth: 1, borderColor: colors.border, borderRadius: 16, color: colors.text, backgroundColor: colors.background, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, textAlignVertical: 'top' },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: colors.muted, fontSize: 11 },
  sendButton: { minWidth: 82, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primary },
  sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  disabledComposer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: 4 },
  disabledComposerTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { maxHeight: '86%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  modalTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: { minHeight: 38, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: '#FCE7F3' },
  reasonText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  reasonTextActive: { color: colors.primary },
  reportInput: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: 14, color: colors.text, padding: spacing.md, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primary },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
