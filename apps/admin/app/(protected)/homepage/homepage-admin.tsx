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

type SignedUploadResponse = { path?: unknown; token?: unknown };

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

function editableFromSaved(saved: HomepageSettings): EditableSettings {
  return {
    hero_desktop_youtube_url: saved.hero_desktop_youtube_url,
    hero_mobile_youtube_url: saved.hero_mobile_youtube_url,
    section2_left_image_url: saved.section2_left_image_url,
    section2_right_image_url: saved.section2_right_image_url,
    section3_background_image_url: saved.section3_background_image_url,
    section4_image_url: saved.section4_image_url,
  };
}

function readableError(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as { message?: unknown; statusCode?: unknown; error?: unknown };
  const parts = [candidate.message, candidate.error, candidate.statusCode]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map(String);
  return parts.join(' · ').slice(0, 280);
}

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
      setSettings(editableFromSaved(current));
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
      setSettings(editableFromSaved(saved));
      setUpdatedAt(saved.updated_at);
      setNotice('Đã lưu cấu hình homepage. Trang chủ đang dùng cơ chế tự làm mới cấu hình.');
    } catch (saveError) {
      const message = readableError(saveError);
      setError(message.includes('youtube')
        ? 'Link video phải là URL YouTube HTTPS hợp lệ.'
        : `Không thể lưu cấu hình homepage hoặc tài khoản không có quyền super_admin.${message ? ` Chi tiết: ${message}` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function cleanupUploadedPath(path: string) {
    const client = getAdminSupabaseClient();
    if (!client) return;
    await client.functions.invoke('homepage-media-admin', {
      body: { action: 'delete_upload', path },
    }).catch(() => undefined);
  }

  async function uploadImage(field: ImageField, file: File | undefined) {
    if (!file) return;
    const client = getAdminSupabaseClient();
    if (!client || !actorUserId) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Ảnh tối đa 8 MB.');
      return;
    }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    if (!allowedTypes.has(file.type)) {
      setError('Chỉ hỗ trợ JPG, PNG, WebP hoặc AVIF.');
      return;
    }

    setUploading(field);
    setError(null);
    setNotice(null);
    let uploadedPath: string | null = null;
    try {
      // The server verifies the current JWT + super_admin role and returns a
      // one-time signed upload token. This avoids relying on browser INSERT RLS
      // for the privileged homepage publishing path.
      const { data: signedData, error: signedError } = await client.functions.invoke('homepage-media-admin', {
        body: { action: 'create_upload', field, contentType: file.type },
      });
      if (signedError) throw signedError;
      const signed = (signedData ?? {}) as SignedUploadResponse;
      const path = typeof signed.path === 'string' ? signed.path : '';
      const token = typeof signed.token === 'string' ? signed.token : '';
      if (!path || !token) throw new Error('signed_upload_token_missing');

      const { error: uploadError } = await client.storage.from('homepage-public').uploadToSignedUrl(path, token, file, {
        cacheControl: '31536000',
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      uploadedPath = path;

      const { data } = client.storage.from('homepage-public').getPublicUrl(path);
      const nextSettings: EditableSettings = { ...settings, [field]: data.publicUrl };
      const saved = await updateAdminHomepageSettings(client, actorUserId, nextSettings);
      setSettings(editableFromSaved(saved));
      setUpdatedAt(saved.updated_at);
      setNotice('Ảnh đã upload và được áp dụng vào homepage. Trang chủ sẽ tự lấy cấu hình mới trong tối đa khoảng 30 giây.');
    } catch (uploadOrSaveError) {
      if (uploadedPath) await cleanupUploadedPath(uploadedPath);
      const detail = readableError(uploadOrSaveError);
      setError(`Upload/áp dụng ảnh thất bại.${detail ? ` Chi tiết: ${detail}` : ' Kiểm tra quyền Super Admin và định dạng ảnh.'}`);
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
        <p style={hintStyle}>Chọn ảnh mới sẽ upload và áp dụng ngay. Mỗi lần upload tạo URL immutable mới nên CDN có thể cache dài hạn mà không giữ nhầm ảnh cũ.</p>
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
                {uploading === slot.field ? <p style={hintStyle}>Đang upload và áp dụng…</p> : null}
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
        <button disabled={busy || uploading !== null || !actorUserId} type="submit">{busy ? 'Đang lưu…' : 'Lưu video / URL thủ công'}</button>
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