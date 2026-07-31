'use client';

import {
  createActivityStorageUrl,
  getCreatorActivityAccess,
  getYouTubeThumbnail,
  listCreatorActivity,
  listCreatorActivityAlbum,
  type CreatorActivityAccess,
  type CreatorActivityAlbumItem,
  type CreatorActivityPost,
} from '@myfan/supabase';
import { useCallback, useEffect, useState } from 'react';
import { getPublicWebSupabaseClient } from '../../src/lib/supabase';

type PublicPost = CreatorActivityPost & { mediaUrl: string | null; avatarUrl: string | null };
type PublicAlbumItem = CreatorActivityAlbumItem & { mediaUrl: string | null };
type FeedState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  access: CreatorActivityAccess | null;
  posts: PublicPost[];
  album: PublicAlbumItem[];
};

export function PublicCreatorActivity() {
  const [username, setUsername] = useState('');
  const [draftUsername, setDraftUsername] = useState('');
  const [state, setState] = useState<FeedState>({ status: 'idle', access: null, posts: [], album: [] });
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('u')?.replace(/^@/, '').trim() ?? '';
    setUsername(value);
    setDraftUsername(value);
  }, []);

  useEffect(() => {
    let active = true;
    if (!username) {
      setState({ status: 'idle', access: null, posts: [], album: [] });
      return () => { active = false; };
    }
    const client = getPublicWebSupabaseClient();
    if (!client) {
      setState({ status: 'error', access: null, posts: [], album: [] });
      return () => { active = false; };
    }

    setState((current) => ({ ...current, status: 'loading' }));
    void getCreatorActivityAccess(client, username)
      .then(async (access) => {
        if (!access || !access.can_view) return { access, posts: [] as PublicPost[], album: [] as PublicAlbumItem[] };
        const [posts, album] = await Promise.all([
          listCreatorActivity(client, username, { limit: 30 }),
          listCreatorActivityAlbum(client, username, { limit: 24 }),
        ]);
        const resolvedPosts = await Promise.all(posts.map(async (post) => {
          const source = post.original_bucket && post.original_path
            ? { bucket: post.original_bucket, path: post.original_path }
            : null;
          const mediaUrl = source
            ? await createActivityStorageUrl(client, source.bucket, source.path, 30).catch(() => null)
            : null;
          const avatarUrl = post.avatar_bucket && post.avatar_path
            ? await createActivityStorageUrl(client, post.avatar_bucket, post.avatar_path, 30).catch(() => null)
            : null;
          return { ...post, mediaUrl, avatarUrl };
        }));
        const resolvedAlbum = await Promise.all(album.map(async (item) => ({
          ...item,
          mediaUrl: await createActivityStorageUrl(client, item.storage_bucket, item.storage_path, 30).catch(() => null),
        })));
        return { access, posts: resolvedPosts, album: resolvedAlbum };
      })
      .then((result) => {
        if (active) setState({ status: 'ready', ...result });
      })
      .catch(() => {
        if (active) setState({ status: 'error', access: null, posts: [], album: [] });
      });

    return () => { active = false; };
  }, [reloadToken, username]);

  function submitUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draftUsername.replace(/^@/, '').trim();
    if (!value) return;
    window.history.replaceState(null, '', `/hoat-dong?u=${encodeURIComponent(value)}`);
    setUsername(value);
  }

  return (
    <>
      <form className="activityPublicLookup" onSubmit={submitUsername}>
        <label htmlFor="activity-username">Username Creator</label>
        <div>
          <input autoCapitalize="none" autoComplete="off" id="activity-username" onChange={(event) => setDraftUsername(event.target.value)} placeholder="@username" value={draftUsername} />
          <button className="primary" type="submit">Xem Hoạt động</button>
        </div>
      </form>

      {!username ? <div className="activityPublicState"><strong>Nhập username Creator</strong><p>MyFan kiểm tra quyền Công khai, Bạn bè hoặc Fan trước khi trả bất kỳ bài viết, ảnh, video hay Album nào.</p></div> : null}
      {state.status === 'loading' ? <div aria-busy="true" className="activityPublicList">{Array.from({ length: 3 }, (_, index) => <div className="activityPublicCard activitySkeleton" key={index} />)}</div> : null}
      {state.status === 'error' ? <div className="activityPublicState" role="alert"><strong>Không thể tải Hoạt động</strong><p>Hãy kiểm tra username hoặc kết nối.</p><button className="secondary activityRetry" onClick={reload} type="button">Thử lại</button></div> : null}
      {state.status === 'ready' && !state.access ? <div className="activityPublicState"><strong>Không tìm thấy Creator</strong><p>Tài khoản không tồn tại, chưa được duyệt hoặc không còn hoạt động.</p></div> : null}
      {state.status === 'ready' && state.access && !state.access.can_view ? <PublicActivityGate access={state.access} /> : null}
      {state.status === 'ready' && state.access?.can_view ? (
        <>
          <PublicActivityAlbum items={state.album} />
          {state.posts.length === 0 ? <div className="activityPublicState"><strong>Chưa có Hoạt động</strong><p>Creator chưa có bài đã được duyệt để hiển thị.</p></div> : null}
          {state.posts.length ? <div className="activityPublicList">{state.posts.map((post) => <PublicActivityCard key={post.post_id} post={post} />)}</div> : null}
        </>
      ) : null}
    </>
  );
}

function PublicActivityGate({ access }: { access: CreatorActivityAccess }) {
  const isFriendGate = access.gate_reason === 'friend_required';
  const isFanGate = access.gate_reason === 'fan_required';
  return (
    <section className="activityPublicGate">
      <span aria-hidden="true">🔒</span>
      <h2>{isFriendGate ? 'Hoạt động dành cho Bạn bè' : isFanGate ? 'Hoạt động dành cho Fan' : 'Hoạt động cần đăng nhập'}</h2>
      <p>
        {isFriendGate
          ? 'Chỉ bạn bè đã chấp nhận và Fan mới xem được toàn bộ bài viết, ảnh, video và Album Hoạt động.'
          : isFanGate
            ? 'Chỉ Fan đang hoạt động mới xem được toàn bộ nội dung. Đăng nhập để chọn quà, ủng hộ Creator và theo dõi tiến độ Fan.'
            : 'Đăng nhập để MyFan xác minh quan hệ Bạn bè hoặc Fan với Creator.'}
      </p>
      <a className="primary" href="/?intent=login">{isFanGate ? 'Đăng nhập và tặng quà để xem' : 'Đăng nhập MyFan'}</a>
      <small>Trang public không thực hiện giao dịch ẩn danh và không trả preview hay original khi chưa đủ quyền.</small>
    </section>
  );
}

function PublicActivityAlbum({ items }: { items: PublicAlbumItem[] }) {
  if (!items.length) return null;
  return (
    <section className="activityPublicAlbum">
      <div className="activityPublicAlbumHeader"><h2>Album Hoạt động</h2><span>{items.length} ảnh gần nhất</span></div>
      <p>Ảnh được lấy trực tiếp từ bài Hoạt động đã duyệt và dùng cùng quyền riêng tư với toàn bộ feed.</p>
      <div className="activityPublicAlbumGrid">
        {items.map((item) => item.mediaUrl ? <img alt={item.body} key={item.media_id} src={item.mediaUrl} /> : <div className="activityPublicAlbumPlaceholder" key={item.media_id}>Ảnh không khả dụng</div>)}
      </div>
    </section>
  );
}

function PublicActivityCard({ post }: { post: PublicPost }) {
  function openExternal(event: React.MouseEvent<HTMLAnchorElement>) {
    if (post.external_provider === 'of_tv' && !window.confirm('Bạn sắp mở nội dung bên ngoài MyFan trên OF.TV. Tiếp tục?')) event.preventDefault();
  }
  return (
    <article className="activityPublicCard">
      <header className="activityPublicCardHeader">
        {post.avatarUrl ? <img alt={`Ảnh đại diện của ${post.display_name}`} className="activityPublicAvatar" src={post.avatarUrl} /> : <span className="activityPublicAvatarFallback">{post.display_name.slice(0, 1).toUpperCase()}</span>}
        <div><div className="activityPublicNameRow"><strong>{post.display_name}</strong><span aria-label="Creator đã được duyệt" className="activityPublicVerified">✓</span></div><small>@{post.username} · {formatDate(post.published_at ?? post.created_at)}</small></div>
      </header>
      <p className="activityPublicBody">{post.body}</p>
      {post.content_type === 'video' && post.external_url ? <a className="activityPublicVideo" href={post.external_url} onClick={openExternal} rel="noreferrer" target="_blank">{post.external_provider === 'youtube' && post.external_video_id ? <img alt="Thumbnail YouTube" src={getYouTubeThumbnail(post.external_video_id)} /> : <div className="activityPublicExternalFallback">OF.TV</div>}<div><strong>{post.external_provider === 'youtube' ? 'YouTube' : 'OF.TV · Liên kết ngoài'}</strong><span>{post.external_url}</span><b>Mở liên kết ›</b></div></a> : null}
      {post.content_type === 'image' ? <div className="activityPublicMedia">{post.mediaUrl ? <img alt={`Ảnh Hoạt động của ${post.display_name}`} src={post.mediaUrl} /> : <div className="activityPublicMediaUnavailable">Ảnh không còn khả dụng</div>}</div> : null}
      <footer className="activityPublicFooter"><span>Hoạt động đã duyệt · cùng quyền với Album</span><a href="/community-standards">Báo cáo trong ứng dụng</a></footer>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
}
