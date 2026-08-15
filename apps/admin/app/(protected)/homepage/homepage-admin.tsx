'use client';

import {
  getAdminHomepageSettings,
  updateAdminHomepageSettings,
  type HomepageSettings,
} from '@myfan/supabase';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../../../src/lib/supabase';

type EditableSettings = Omit<HomepageSettings, 'updated_at'>;
type ImageField =
  | 'section2_left_image_url'
  | 'section2_right_image_url'
  | 'section3_background_image_url'
  | 'section4_image_url';

const emptySettings: EditableSettings = {
  hero_desktop_youtube_url: null,
  hero_mobile_youtube_url: null,
  section2_left_image_url: null,
  section2_right_image_url: null,
  section3_background_image_url: null,
  section4_image_url: null,
};

const imageSlots: Array<{ field: ImageField; label: string; hint: string }> = [
  { field: 'section2_left_image_url', label: 'Section 2 · Ảnh trái', hint: 'Ảnh dọc hoặc vuông, chủ thể rõ, phù hợp crop bo tròn.' },
  { field: 'section2_right_image_url', label: 'Section 2 · Ảnh phải', hint: 'Ảnh dọc hoặc vuông, chủ thể rõ, phù hợp crop bo tròn.' },
  { field: 'section3_background_image_url', label: 'Section 3 · Nền testimonials', hint: 'Ưu tiên ảnh ngang từ 1600px, có khoảng trống để chữ dễ đọc.' },
  { field: 'section4_image_url', label: 'Section 4 · Ảnh quyền lợi', hint: 'Ưu tiên ảnh dọc chất lượng cao, phù hợp khung oval.' },
];

export function HomepageAdmin() {
  const [actorUserId, setActorUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<EditableSettings>(emptySettings);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<ImageField | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = getAdminSupabaseClient();
    if (!client) {
      setError('Supabase Admin chưa được cấu hình.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('admin_login_required');
      const current = await getAdminHomepageSettings(client, userId);
      setActorUserId(userId);
      setSettings({
        hero_desktop_youtube_url: current.hero_desktop_youtube_url,
        hero_mobile_youtube_url: current.hero_mobile_youtube_url,
        section2_left_image_url: current.section2_left_image_url,
        section2_right_image_url: current.section2_right_image_url,
        section3_background_image_url: current.section3_background_image_url,
        section4_image_url: current.section4_image_url,
      });
      setUpdatedAt(current.updated_at);
    } catch {
      setError('Không thể tải cấu hình homepage. Tài khoản hiện tại cần role super_admin.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getAdminSupabaseClient();
    if (!client || !actorUserId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await updateAdminHomepageSettings(client, actorUserId, settings);
      setSettings({
        hero_desktop_youtube_url: saved.hero_desktop_youtube_url,
        hero_mobile_youtube_url: saved.hero_mobile_youtube_url,
        section2_left_image_url: saved.section2_left_image_url,
        section2_right_image_url: saved.section2_right_image_url,
        section3_background_image_url: saved.section3_background_image_url,
        section4_image_url: saved.section4_image_url,
      });
      setUpdatedAt(saved.updated_at);
      setNotice('Đã lưu cấu hình homepage. Trang chủ sẽ nhận cấu hình mới khi cache dữ liệu được làm mới.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '';
      setError(message.includes('youtube') ? 'Link video phải là URL YouTube HTTPS hợp lệ.' : 'Không thể lưu cấu hình homepage hoặc tài khoản không có quyền super_admin.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(field: ImageField, file: File | undefined) {
    if (!file) return;
    const client = getAdminSupabaseClient();
    if (!client || !actorUserId) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Ảnh tối đa 8 MB.');
      return;
    }
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
    };
    const extension = extensionByType[file.type];
    if (!extension) {
      setError('Chỉ hỗ trợ JPG, PNG, WebP hoặc AVIF.');
      return;
    }

    setUploading(field);
    setError(null);
    setNotice(null);
    try {
      const path = `homepage/${field}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage.from('homepage-public').upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = client.storage.from('homepage-public').getPublicUrl(path);
      setSettings((current) => ({ ...current, [field]: data.publicUrl }));
      setNotice('Ảnh đã upload. Bấm “Lưu homepage” để áp dụng URL mới.');
    } catch {
      setError('Upload ảnh thất bại hoặc tài khoản không có quyền super_admin.');
    } finally {
      setUploading(null);
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 24, marginTop: 20 }}>
      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Hero video</h2>
        <p style={hintStyle}>Dùng 2 video riêng để tối ưu bố cục desktop và mobile. Video được tải poster trước, YouTube player chỉ khởi tạo khi trình duyệt rảnh.</p>
        <label style={fieldStyle}>
          <strong>YouTube desktop</strong>
          <input
            onChange={(event) => setSettings((current) => ({ ...current, hero_desktop_youtube_url: cleanValue(event.target.value) }))}
            placeholder="https://www.youtube.com/watch?v=..."
            type="url"
            value={settings.hero_desktop_youtube_url ?? ''}
          />
        </label>
        <label style={fieldStyle}>
          <strong>YouTube mobile</strong>
          <input
            onChange={(event) => setSettings((current) => ({ ...current, hero_mobile_youtube_url: cleanValue(event.target.value) }))}
            placeholder="https://www.youtube.com/watch?v=..."
            type="url"
            value={settings.hero_mobile_youtube_url ?? ''}
          />
        </label>
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Ảnh homepage</h2>
        <p style={hintStyle}>Ảnh dùng đường dẫn immutable và cache dài hạn để tải nhanh. Upload ảnh mới sẽ tạo URL mới nên không bị cache ảnh cũ.</p>
        <div style={{ display: 'grid', gap: 18 }}>
          {imageSlots.map((slot) => (
            <div key={slot.field} style={imageRowStyle}>
              <div style={{ minWidth: 0 }}>
                <strong>{slot.label}</strong>
                <p style={hintStyle}>{slot.hint}</p>
                <input
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={busy || uploading !== null}
                  onChange={(event) => void uploadImage(slot.field, event.target.files?.[0])}
                  type="file"
                />
                <label style={{ ...fieldStyle, marginTop: 10 }}>
                  <span>URL ảnh</span>
                  <input
                    onChange={(event) => setSettings((current) => ({ ...current, [slot.field]: cleanValue(event.target.value) }))}
                    placeholder="https://..."
                    type="url"
                    value={settings[slot.field] ?? ''}
                  />
                </label>
                {uploading === slot.field ? <p style={hintStyle}>Đang upload…</p> : null}
              </div>
              <div style={previewStyle}>
                {settings[slot.field] ? <img alt={`Preview ${slot.label}`} src={settings[slot.field] ?? ''} style={previewImageStyle} /> : <span style={hintStyle}>Chưa có ảnh tùy chỉnh</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}
      {notice ? <p role="status" style={{ color: '#166534', margin: 0 }}>{notice}</p> : null}
      {updatedAt ? <p style={hintStyle}>Cập nhật gần nhất: {new Date(updatedAt).toLocaleString('vi-VN')}</p> : null}
      <div style={{ display: 'flex', gap: 10 }}>
        <button disabled={busy || uploading !== null || !actorUserId} type="submit">{busy ? 'Đang lưu…' : 'Lưu homepage'}</button>
        <button disabled={busy || uploading !== null} onClick={() => void load()} type="button">Tải lại</button>
      </div>
    </form>
  );
}

function cleanValue(value: string): string | null {
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

const panelStyle = { border: '1px solid #e5e7eb', borderRadius: 10, display: 'grid', gap: 14, padding: 18 } as const;
const fieldStyle = { display: 'grid', gap: 6 } as const;
const hintStyle = { color: '#6b7280', fontSize: 13, lineHeight: 1.5, margin: 0 } as const;
const imageRowStyle = { alignItems: 'start', display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) 220px', paddingBottom: 18, borderBottom: '1px solid #eee' } as const;
const previewStyle = { alignItems: 'center', background: '#faf7f5', border: '1px solid #eee', borderRadius: 8, display: 'flex', height: 150, justifyContent: 'center', overflow: 'hidden' } as const;
const previewImageStyle = { height: '100%', objectFit: 'cover', width: '100%' } as const;
