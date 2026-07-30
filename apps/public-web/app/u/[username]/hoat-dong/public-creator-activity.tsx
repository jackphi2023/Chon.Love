'use client';

import {
  createActivityStorageUrl,
  getYouTubeThumbnail,
  listCreatorActivity,
  type CreatorActivityPost,
} from '@myfan/supabase';
import { useCallback, useEffect, useState } from 'react';
import { getPublicWebSupabaseClient } from '../../../../src/lib/supabase';

type PublicPost = CreatorActivityPost & { mediaUrl: string | null; avatarUrl: string | null };
type FeedState =
  | { status: 'loading'; posts: PublicPost[] }
  | { status: 'ready'; posts: PublicPost[] }
  | { status: 'error'; posts: PublicPost[] };

export function PublicCreatorActivity({ username }: { username: string }) {
  const [state, setState] = useState<FeedState>({ status: 'loading', posts: [] });
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const client = getPublicWebSupabaseClient();
    if (!client || !username) {
      setState({ status: 'error', posts: [] });
      return () => { active = false; };
    }

    setState((current) => ({ status: 'loading', posts: current.posts }));
    void listCreatorActivity(client, username, { limit: 30 })
      .then(async (posts) => Promise.all(posts.map(async (post) => {
        const source = post.original_bucket && post.original_path
          ? { bucket: post.original_bucket, path: post.original_path }
          : post.preview_bucket && post.preview_path
            ? { bucket: post.preview_bucket, path: post.preview_path }
            : null;
        const mediaUrl = source
          ? await createActivityStorageUrl(client, source.bucket, source.path, 30).catch(() => null)
          : null;
        const avatarUrl = post.avatar_bucket && post.avatar_path
          ? await createActivityStorageUrl(client, post.avatar_bucket, post.avatar_path, 30).catch(() => null)
          : null;
        return { ...post, mediaUrl, avatarUrl };
      })))
      .then((posts) => {
        if (active) setState({ status: 'ready', posts });
      })
      .catch(() => {
        if (active) setState({ status: 'error', posts: [] });
      });

    return () => { active = false; };
  }, [reloadToken, username]);

  if (state.status === 'loading' && state.posts.length === 0) {
    return (
      <div aria-busy="true" aria-label="Đang tải Hoạt động" className="activityPublicList">
        {Array.from({ length: 3 }, (_, index) => <div className="activityPublicCard activitySkeleton" key={index} />)}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="activityPublicState" role="alert">
        <strong>Không thể tải Hoạt động</strong>
        <p>Hãy kiểm tra kết nối hoặc thử lại sau.</p>
        <button className="secondary activityRetry" onClick={reload} type="button">Thử lại</button>
      </div>
    );
  }
  if (state.posts.length === 0) {
    return <div className="activityPublicState"><strong>Chưa có Hoạt động công khai</strong><p>Creator chưa có bài đã được duyệt để hiển thị.</p></div>;
  }

  return (
    <div className="activityPublicList">
      {state.posts.map((post) => <PublicActivityCard key={post.post_id} post={post} />)}
    </div>
  );
}

function PublicActivityCard({ post }: { post: PublicPost }) {
  const locked = post.content_type === 'image' && post.image_access_mode === 'gift_locked';
  function openExternal(event: React.MouseEvent<HTMLAnchorElement>) {
    if (post.external_provider !== 'of_tv') return;
    if (!window.confirm('Bạn sắp mở nội dung bên ngoài MyFan trên OF.TV. Tiếp tục?')) event.preventDefault();
  }

  return (
    <article className="activityPublicCard">
      <header className="activityPublicCardHeader">
        {post.avatarUrl ? <img alt={`Ảnh đại diện của ${post.display_name}`} className="activityPublicAvatar" src={post.avatarUrl} /> : <span className="activityPublicAvatarFallback">{post.display_name.slice(0, 1).toUpperCase()}</span>}
        <div>
          <div className="activityPublicNameRow"><strong>{post.display_name}</strong><span aria-label="Creator đã được duyệt" className="activityPublicVerified">✓</span></div>
          <small>@{post.username} · {formatDate(post.published_at ?? post.created_at)}</small>
        </div>
      </header>
      <p className="activityPublicBody">{post.body}</p>

      {post.content_type === 'video' && post.external_url ? (
        <a className="activityPublicVideo" href={post.external_url} onClick={openExternal} rel="noreferrer" target="_blank">
          {post.external_provider === 'youtube' && post.external_video_id ? <img alt="Thumbnail YouTube" src={getYouTubeThumbnail(post.external_video_id)} /> : <div className="activityPublicExternalFallback">OF.TV</div>}
          <div><strong>{post.external_provider === 'youtube' ? 'YouTube' : 'OF.TV · Liên kết ngoài'}</strong><span>{post.external_url}</span><b>Mở liên kết ›</b></div>
        </a>
      ) : null}

      {post.content_type === 'image' ? (
        <div className="activityPublicMedia">
          {post.mediaUrl ? <img alt={`Ảnh Hoạt động của ${post.display_name}`} src={post.mediaUrl} /> : <div className="activityPublicMediaUnavailable">Preview đang được xử lý</div>}
          {locked ? (
            <div className="activityPublicLock">
              <span aria-hidden="true">🔒</span>
              <strong>1 ảnh đang được khóa</strong>
              <p>{post.required_gift_icon_emoji} {post.required_gift_name_vi} · {post.required_gift_hearts} ❤️</p>
              <a className="primary" href="/?intent=login">Đăng nhập để tặng {post.required_gift_name_vi ?? 'quà'}</a>
            </div>
          ) : null}
        </div>
      ) : null}
      <footer className="activityPublicFooter"><span>Hoạt động công khai đã kiểm duyệt</span><a href="/community-standards">Báo cáo trong ứng dụng</a></footer>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
}
