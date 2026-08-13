from pathlib import Path

chat_path = Path('packages/supabase/src/chat.ts')
chat = chat_path.read_text()
old = "  auto_delete_enabled: z.boolean(),\n"
new = "  auto_delete_enabled: z.boolean().nullable().transform((value) => value ?? false),\n"
if old not in chat:
    raise SystemExit('chat retention schema target not found')
chat_path.write_text(chat.replace(old, new, 1))

test_path = Path('packages/supabase/src/chat.test.ts')
test = test_path.read_text()
test = test.replace(
    "import { describe, expect, it } from 'vitest';",
    "import { describe, expect, it, vi } from 'vitest';",
    1,
)
old_import = "  getNextChatExpiryMs,\n  getOlderMessageCursor,\n"
new_import = "  getConversationRetention,\n  getNextChatExpiryMs,\n  getOlderMessageCursor,\n"
if old_import not in test:
    raise SystemExit('chat test import target 1 not found')
test = test.replace(old_import, new_import, 1)
old_import = "  mergeChatMessagesNewestFirst,\n  type ChatMessage,\n"
new_import = "  mergeChatMessagesNewestFirst,\n  setConversationAutoDelete,\n  type ChatMessage,\n"
if old_import not in test:
    raise SystemExit('chat test import target 2 not found')
test = test.replace(old_import, new_import, 1)
anchor = """  it('physically expires client-visible messages at seven days when enabled', () => {"""
regression = """  it('normalizes a disabled SQL retention flag from null to false', async () => {
    const disabledRow = {
      conversation_id: conversation.conversation_id,
      auto_delete_enabled: null,
      auto_delete_after_days: null,
      updated_at: null,
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ error: null, data: [disabledRow] })
      .mockResolvedValueOnce({ error: null, data: [{ ...disabledRow, deleted_messages: 0 }] });

    await expect(getConversationRetention({ rpc } as never, conversation.conversation_id)).resolves.toEqual({
      ...disabledRow,
      auto_delete_enabled: false,
    });
    await expect(setConversationAutoDelete({ rpc } as never, conversation.conversation_id, false)).resolves.toEqual({
      ...disabledRow,
      auto_delete_enabled: false,
      deleted_messages: 0,
    });
  });

"""
if regression.strip() not in test:
    if anchor not in test:
        raise SystemExit('chat test regression anchor not found')
    test = test.replace(anchor, regression + anchor, 1)
test_path.write_text(test)

qa_path = Path('tests/br-06/web-r02-final-ui-qa.spec.mjs')
qa = qa_path.read_text()
fixture_anchor = "const freeActor = { email: 'br06.outsider@example.test' };\n\n"
profile_fixture = """const profileVisualFixture = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece5df"/><stop offset="1" stop-color="#bfc7cd"/></linearGradient></defs>
  <rect width="320" height="420" fill="url(#g)"/>
  <circle cx="160" cy="135" r="66" fill="#7a858f"/>
  <rect x="55" y="195" width="210" height="205" rx="100" fill="#626e79"/>
  <path d="M270 28l22 22-22 22-22-22z" fill="none" stroke="#b58937" stroke-width="4"/>
  <text x="18" y="28" font-family="Arial" font-size="14" fill="#444">Luxy QA</text>
</svg>`;

"""
if 'const profileVisualFixture' not in qa:
    if fixture_anchor not in qa:
        raise SystemExit('R02 profile fixture anchor not found')
    qa = qa.replace(fixture_anchor, fixture_anchor + profile_fixture, 1)

route_anchor = """    try {
      await freePage.route('https://img.vietqr.io/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: vietQrVisualFixture });
      });
      await Promise.all([login(page, premiumActor), login(freePage, freeActor)]);"""
route_replacement = """    try {
      await freePage.route('https://img.vietqr.io/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: vietQrVisualFixture });
      });
      for (const target of [page, freePage]) {
        await target.route('**/storage/v1/object/sign/profile-media/**', async (route) => {
          if (route.request().method() !== 'GET') {
            await route.continue();
            return;
          }
          await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: profileVisualFixture });
        });
      }
      await Promise.all([login(page, premiumActor), login(freePage, freeActor)]);"""
if "target.route('**/storage/v1/object/sign/profile-media/**'" not in qa:
    if route_anchor not in qa:
        raise SystemExit('R02 media route anchor not found')
    qa = qa.replace(route_anchor, route_replacement, 1)

chat_anchor = """      await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true })).toBeVisible({ timeout: 20_000 });
      await capture(page, testInfo, viewport, 'chat');"""
chat_replacement = """      await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true })).toBeVisible({ timeout: 20_000 });
      const retentionSwitch = page.getByRole('switch', { name: 'Tự động xóa tin nhắn sau 7 ngày cho cả hai người' });
      await expect(retentionSwitch).toBeVisible({ timeout: 20_000 });
      await expect(retentionSwitch).toBeEnabled({ timeout: 20_000 });
      await expect(page.getByText('Không thể tải cài đặt tự động xóa', { exact: false })).toHaveCount(0);
      await capture(page, testInfo, viewport, 'chat');"""
if 'const retentionSwitch' not in qa:
    if chat_anchor not in qa:
        raise SystemExit('R02 chat assertion anchor not found')
    qa = qa.replace(chat_anchor, chat_replacement, 1)
qa_path.write_text(qa)
