from pathlib import Path

path = Path("apps/mobile/app/chat/[conversationId].tsx")
text = path.read_text()
old = '''        {successMessage ? <Text accessibilityRole="alert" style={styles.success}>{successMessage}</Text> : null}
        {errorMessage || retentionQuery.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage ?? 'Không thể tải cài đặt tự động xóa. Hãy thử lại.'}
          </Text>
        ) : null}
'''
new = '''        {successMessage ? <Text accessibilityRole="alert" style={styles.success}>{successMessage}</Text> : null}
        {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
        {retentionQuery.error && !errorMessage ? (
          <View accessibilityLiveRegion="polite" style={styles.retentionErrorRow}>
            <Text style={styles.retentionErrorText}>Không thể tải cài đặt tự động xóa. Tin nhắn và thao tác an toàn khác vẫn hoạt động.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void retentionQuery.refetch()}
              style={styles.retentionRetryButton}
            >
              <Text style={styles.retentionRetryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}
'''
if old not in text:
    raise SystemExit("chat alert block not found")
text = text.replace(old, new, 1)
old_styles = '''  success: { color: '#166534', fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
'''
new_styles = '''  success: { color: '#166534', fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  retentionErrorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  retentionErrorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  retentionRetryButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: 12, paddingHorizontal: spacing.md },
  retentionRetryText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
'''
if old_styles not in text:
    raise SystemExit("chat styles block not found")
path.write_text(text.replace(old_styles, new_styles, 1))
