'use client';

import {
  HOMEPAGE_HERO_MAX_SLIDES,
  getAdminHomepageSettings,
  updateAdminHomepageSettings,
  type HomepageHeroSlide,
  type HomepageSettings,
} from '@myfan/supabase';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getAdminSupabaseClient } from '../../../src/lib/supabase';

type HeroSlideDraft = {
  id: string;
  desktop_url: string | null;
  mobile_url: string | null;
};

type EditableSettings = Omit<HomepageSettings, 'updated_at' | 'hero_slider_images'> & {
  hero_slider_images: HeroSlideDraft[];
};

type ImageField =
  | 'section2_left_image_url'
  | 'section2_right_image_url'
  | 'section3_background_image_url'
  | 'section4_image_url';

type UploadField = ImageField | 'hero_slider_desktop' | 'hero_slider_mobile';
type SignedUploadResponse = { path?: unknown; token?: unknown };

const emptySettings: EditableSettings = {
  hero_desktop_youtube_url: null,
  hero_mobile_youtube_url: null,
  hero_slider_images: [],
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

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxUploadBytes = 8 * 1024 * 1024;

function editableFromSaved(saved: HomepageSettings): EditableSettings {
  return {
    hero_desktop_youtube_url: saved.hero_desktop_youtube_url,
    hero_mobile_youtube_url: saved.hero_mobile_youtube_url,
    hero_slider_images: saved.hero_slider_images.map((slide) => ({ ...slide })),
    section2_left_image_url: saved.section2_left_image_url,
    section2_right_image_url: saved.section2_right_image_url,
    section3_background_image_url: saved.section3_background_image_url,
    section4_image_url: saved.section4_image_url,
  };
}

function publishableFromDraft(settings: EditableSettings): Omit<HomepageSettings, 'updated_at'> {
  const incompleteIndex = settings.hero_slider_images.findIndex((slide) => !slide.desktop_url || !slide.mobile_url);
  if (incompleteIndex >= 0) throw new Error(`incomplete_hero_slide:${incompleteIndex + 1}`);

  return {
    ...settings,
    hero_slider_images: settings.hero_slider_images.map((slide): HomepageHeroSlide => ({
      id: slide.id,
      desktop_url: slide.desktop_url!,
      mobile_url: slide.mobile_url!,
    })),
  };
}

function readableError(error: unknown): string {
  if (!error || typeof error !== 'object') return error instanceof Error ? error.message : '';
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
  const [uploading, setUploading] = useState<string | null>(null);
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
      const saved = await updateAdminHomepageSettings(client, actorUserId, publishableFromDraft(settings));
      setSettings(editableFromSaved(saved));
      setUpdatedAt(saved.updated_at);
      setNotice(saved.hero_slider_images.length > 0
        ? `Đã lưu homepage với ${saved.hero_slider_images.length} slide. Slider đang được ưu tiên; YouTube sẽ không được tải ngoài trang chủ.`
        : 'Đã lưu homepage. Không có slider ảnh nên Hero sẽ dùng YouTube đã cấu hình.');
    } catch (saveError) {
      const message = readableError(saveError);
      if (message.includes('incomplete_hero_slide')) {
        const slideNumber = message.split(':')[1] ?? '';
        setError(`Slide ${slideNumber} chưa đủ ảnh Desktop và Mobile. Mỗi slide cần đủ cả 2 ảnh trước khi lưu.`);
      } else if (message.includes('youtube')) {
        setError('Link video phải là URL YouTube HTTPS hợp lệ.');
      } else {
        setError(`Không thể lưu cấu hình homepage hoặc tài khoản không có quyền super_admin.${message ? ` Chi tiết: ${message}` : ''}`);
      }
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

  async function uploadPublicImage(field: UploadField, file: File, uploadKey: string): Promise<string> {
    const client = getAdminSupabaseClient();
    if (!client || !actorUserId) throw new Error('admin_login_required');
    if (file.size > maxUploadBytes) throw new Error('image_too_large');
    if (!allowedImageTypes.has(file.type)) throw new Error('unsupported_image_type');

    setUploading(uploadKey);
    setError(null);
    setNotice(null);
    let uploadedPath: string | null = null;
    try {
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
      return data.publicUrl;
    } catch (uploadError) {
      if (uploadedPath) await cleanupUploadedPath(uploadedPath);
      throw uploadError;
    } finally {
      setUploading(null);
    }
  }

  async function uploadStaticImage(field: ImageField, file: File | undefined) {
    if (!file) return;
    try {
      const publicUrl = await uploadPublicImage(field, file, field);
      setSettings((current) => ({ ...current, [field]: publicUrl }));
      setNotice('Ảnh đã upload. Bấm “Lưu cấu hình homepage” để áp dụng thay đổi ngoài trang chủ.');
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError));
    }
  }

  async function uploadHeroImage(slideId: string, variant: 'desktop' | 'mobile', file: File | undefined) {
    if (!file) return;
    const uploadField: UploadField = variant === 'desktop' ? 'hero_slider_desktop' : 'hero_slider_mobile';
    const uploadKey = `hero:${slideId}:${variant}`;
    try {
      const publicUrl = await uploadPublicImage(uploadField, file, uploadKey);
      setSettings((current) => ({
        ...current,
        hero_slider_images: current.hero_slider_images.map((slide) => (
          slide.id === slideId ? { ...slide, [`${variant}_url`]: publicUrl } : slide
        )),
      }));
      setNotice('Ảnh slider đã upload. Bấm “Lưu cấu hình homepage” để công bố slider.');
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError));
    }
  }

  function addHeroSlide() {
    if (settings.hero_slider_images.length >= HOMEPAGE_HERO_MAX_SLIDES) {
      setError(`Tối đa ${HOMEPAGE_HERO_MAX_SLIDES} slide để giữ tốc độ tải trang chủ ổn định.`);
      return;
    }
    setError(null);
    setSettings((current) => ({
      ...current,
      hero_slider_images: [
        ...current.hero_slider_images,
        { id: crypto.randomUUID(), desktop_url: null, mobile_url: null },
      ],
    }));
  }

  function removeHeroSlide(slideId: string) {
    setSettings((current) => ({
      ...current,
      hero_slider_images: current.hero_slider_images.filter((slide) => slide.id !== slideId),
    }));
    setNotice('Đã bỏ slide khỏi bản nháp. Bấm “Lưu cấu hình homepage” để áp dụng.');
  }

  function moveHeroSlide(index: number, direction: -1 | 1) {
    setSettings((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.hero_slider_images.length) return current;
      const next = [...current.hero_slider_images];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...current, hero_slider_images: next };
    });
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 24, marginTop: 20 }}>
      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Hero · Slider ảnh</h2>
            <p style={hintStyle}>Ưu tiên cao nhất. Khi có ít nhất 1 slide đã lưu, homepage chỉ hiển thị slider ảnh và không khởi tạo YouTube. Xóa toàn bộ slide rồi lưu để tự động dùng lại YouTube.</p>
          </div>
          <button disabled={busy || uploading !== null || settings.hero_slider_images.length >= HOMEPAGE_HERO_MAX_SLIDES} onClick={addHeroSlide} type="button">+ Thêm slide</button>
        </div>
        <div style={recommendationStyle}>
          <strong>Kích thước khuyến nghị</strong>
          <span>Desktop ngang: 1920 × 1080 px (16:9), tối thiểu 1600 × 900 px.</span>
          <span>Mobile dọc: 1080 × 1920 px (9:16).</span>
          <span>Ưu tiên WebP / AVIF / JPG đã nén, nên khoảng 500 KB–1.5 MB; giới hạn kỹ thuật 8 MB/ảnh. Hero dùng chế độ cover/full như video nên hãy đặt chủ thể và chữ quan trọng ở vùng giữa để tránh bị crop ở các màn hình khác nhau.</span>
        </div>
        {settings.hero_slider_images.length === 0 ? (
          <div style={emptySliderStyle}>Chưa có slider ảnh. Homepage hiện sẽ dùng YouTube Hero bên dưới.</div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            {settings.hero_slider_images.map((slide, index) => (
              <div key={slide.id} style={slideCardStyle}>
                <div style={slideHeaderStyle}>
                  <strong>Slide {index + 1}</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button aria-label={`Đưa slide ${index + 1} lên`} disabled={busy || uploading !== null || index === 0} onClick={() => moveHeroSlide(index, -1)} type="button">↑</button>
                    <button aria-label={`Đưa slide ${index + 1} xuống`} disabled={busy || uploading !== null || index === settings.hero_slider_images.length - 1} onClick={() => moveHeroSlide(index, 1)} type="button">↓</button>
                    <button aria-label={`Xóa slide ${index + 1}`} disabled={busy || uploading !== null} onClick={() => removeHeroSlide(slide.id)} type="button">Xóa</button>
                  </div>
                </div>
                <div style={heroPairGridStyle}>
                  <HeroImageEditor
                    busy={busy || uploading !== null}
                    label="Ảnh Desktop · ngang"
                    loading={uploading === `hero:${slide.id}:desktop`}
                    onFile={(file) => void uploadHeroImage(slide.id, 'desktop', file)}
                    onUrl={(value) => setSettings((current) => ({
                      ...current,
                      hero_slider_images: current.hero_slider_images.map((item) => item.id === slide.id ? { ...item, desktop_url: cleanValue(value) } : item),
                    }))}
                    previewMode="desktop"
                    value={slide.desktop_url}
                  />
                  <HeroImageEditor
                    busy={busy || uploading !== null}
                    label="Ảnh Mobile · dọc"
                    loading={uploading === `hero:${slide.id}:mobile`}
                    onFile={(file) => void uploadHeroImage(slide.id, 'mobile', file)}
                    onUrl={(value) => setSettings((current) => ({
                      ...current,
                      hero_slider_images: current.hero_slider_images.map((item) => item.id === slide.id ? { ...item, mobile_url: cleanValue(value) } : item),
                    }))}
                    previewMode="mobile"
                    value={slide.mobile_url}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Hero · YouTube dự phòng</h2>
        <p style={hintStyle}>Chỉ được hiển thị khi không có slider ảnh đã lưu. Có thể giữ sẵn 2 link YouTube; khi slider bị xóa hết, homepage tự quay lại video mà không cần nhập lại.</p>
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
        <h2 style={{ margin: 0 }}>Ảnh homepage khác</h2>
        <p style={hintStyle}>Ảnh upload tạo URL immutable để CDN cache dài hạn. Ảnh chỉ được công bố sau khi bấm “Lưu cấu hình homepage”, tránh trạng thái cập nhật nửa chừng.</p>
        <div style={{ display: 'grid', gap: 18 }}>
          {imageSlots.map((slot) => (
            <div key={slot.field} style={imageRowStyle}>
              <div style={{ minWidth: 0 }}>
                <strong>{slot.label}</strong>
                <p style={hintStyle}>{slot.hint}</p>
                <input
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={busy || uploading !== null}
                  onChange={(event) => void uploadStaticImage(slot.field, event.target.files?.[0])}
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
        <button disabled={busy || uploading !== null || !actorUserId} type="submit">{busy ? 'Đang lưu…' : 'Lưu cấu hình homepage'}</button>
        <button disabled={busy || uploading !== null} onClick={() => void load()} type="button">Tải lại</button>
      </div>
    </form>
  );
}

function HeroImageEditor({
  label,
  value,
  previewMode,
  busy,
  loading,
  onFile,
  onUrl,
}: {
  label: string;
  value: string | null;
  previewMode: 'desktop' | 'mobile';
  busy: boolean;
  loading: boolean;
  onFile: (file: File | undefined) => void;
  onUrl: (value: string) => void;
}) {
  return (
    <div style={heroEditorStyle}>
      <strong>{label}</strong>
      <input
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={busy}
        onChange={(event) => onFile(event.target.files?.[0])}
        type="file"
      />
      <label style={fieldStyle}>
        <span>URL ảnh</span>
        <input onChange={(event) => onUrl(event.target.value)} placeholder="https://..." type="url" value={value ?? ''} />
      </label>
      <div style={previewMode === 'mobile' ? mobileHeroPreviewStyle : desktopHeroPreviewStyle}>
        {value ? <img alt={`Preview ${label}`} src={value} style={previewImageStyle} /> : <span style={hintStyle}>Chưa có ảnh</span>}
      </div>
      {loading ? <p style={hintStyle}>Đang upload…</p> : null}
    </div>
  );
}

function uploadErrorMessage(error: unknown): string {
  const detail = readableError(error);
  if (detail.includes('image_too_large')) return 'Ảnh tối đa 8 MB.';
  if (detail.includes('unsupported_image_type')) return 'Chỉ hỗ trợ JPG, PNG, WebP hoặc AVIF.';
  return `Upload ảnh thất bại.${detail ? ` Chi tiết: ${detail}` : ' Kiểm tra quyền Super Admin và định dạng ảnh.'}`;
}

function cleanValue(value: string): string | null {
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

const panelStyle = { border: '1px solid #e5e7eb', borderRadius: 10, display: 'grid', gap: 14, padding: 18 } as const;
const fieldStyle = { display: 'grid', gap: 6 } as const;
const hintStyle = { color: '#6b7280', fontSize: 13, lineHeight: 1.5, margin: 0 } as const;
const sectionHeaderStyle = { alignItems: 'start', display: 'flex', gap: 16, justifyContent: 'space-between' } as const;
const recommendationStyle = { background: '#fff8e8', border: '1px solid #f3d58a', borderRadius: 8, display: 'grid', fontSize: 13, gap: 5, lineHeight: 1.5, padding: 12 } as const;
const emptySliderStyle = { background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8, color: '#6b7280', padding: 18, textAlign: 'center' } as const;
const slideCardStyle = { border: '1px solid #e5e7eb', borderRadius: 10, display: 'grid', gap: 14, padding: 14 } as const;
const slideHeaderStyle = { alignItems: 'center', display: 'flex', justifyContent: 'space-between' } as const;
const heroPairGridStyle = { alignItems: 'start', display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' } as const;
const heroEditorStyle = { display: 'grid', gap: 9, minWidth: 0 } as const;
const desktopHeroPreviewStyle = { alignItems: 'center', aspectRatio: '16 / 9', background: '#111', border: '1px solid #eee', borderRadius: 8, display: 'flex', justifyContent: 'center', maxHeight: 230, overflow: 'hidden', width: '100%' } as const;
const mobileHeroPreviewStyle = { alignItems: 'center', aspectRatio: '9 / 16', background: '#111', border: '1px solid #eee', borderRadius: 8, display: 'flex', justifyContent: 'center', maxHeight: 320, overflow: 'hidden', width: 180 } as const;
const imageRowStyle = { alignItems: 'start', display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) 220px', paddingBottom: 18, borderBottom: '1px solid #eee' } as const;
const previewStyle = { alignItems: 'center', background: '#faf7f5', border: '1px solid #eee', borderRadius: 8, display: 'flex', height: 150, justifyContent: 'center', overflow: 'hidden' } as const;
const previewImageStyle = { height: '100%', objectFit: 'cover', width: '100%' } as const;
