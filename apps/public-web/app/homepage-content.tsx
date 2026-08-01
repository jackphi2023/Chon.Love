'use client';

import {
  createActivityStorageUrl,
  getYouTubeThumbnail,
  listPublicActivityHighlights,
  listPublicFeaturedCreators,
  truncatePublicHomepageText,
  type PublicActivityHighlight,
  type PublicFeaturedCreator,
} from '@myfan/supabase';
import { useCallback, useEffect, useState } from 'react';
import { getPublicWebSupabaseClient } from '../src/lib/supabase';

type CreatorCard = PublicFeaturedCreator & { avatarUrl: string | null };
type ActivityCard = PublicActivityHighlight & {
  avatarUrl: string | null;
  mediaUrl: string | null;
};

type HomepageState =
  | { status: 'loading'; creators: CreatorCard[]; activity: ActivityCard[] }
  | { status: 'ready'; creators: CreatorCard[]; activity: ActivityCard[] }
  | { status: 'error'; creators: CreatorCard[]; activity: ActivityCard[] };

const INITIAL_STATE: HomepageState = { status: 'loading', creators: [], activity: [] };

export function HomepagePublicContent() {
  const [state, setState] = useState<HomepageState>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const client = getPublicWebSupabaseClient();
    if (!client) {
      setState({ status: 'error', creators: [], activity: [] });
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, status: 'loading' }));
    void Promise.all([
      listPublicFeaturedCreators(client, 6),
      listPublicActivityHighlights(client, 6),
    ])
      .then(async ([creators, activity]) => {
        const creatorCards = await Promise.all(
          creators.map(async (creator): Promise<CreatorCard> => ({
            ...creator,
            avatarUrl:
              creator.avatar_bucket && creator.avatar_path
                ? await createActivityStorageUrl(
                    client,
                    creator.avatar_bucket,
                    creator.avatar_path,
                    60,
                  ).catch(() => null)
                : null,
          })),
        );

        const activityCards = await Promise.all(
          activity.map(async (post): Promise<ActivityCard> => ({
            ...post,
            avatarUrl:
              post.avatar_bucket && post.avatar_path
                ? await createActivityStorageUrl(
                    client,
                    post.avatar_bucket,
                    post.avatar_path,
                    60,
                  ).catch(() => null)
                : null,
            mediaUrl:
              post.media_bucket && post.media_path
                ? await createActivityStorageUrl(
                    client,
                    post.media_bucket,
                    post.media_path,
                    60,
                  ).catch(() => null)
                : null,
          })),
        );

        if (active) {
          setState({ status: 'ready', creators: creatorCards, activity: activityCards });
        }
      })
      .catch(() => {
        if (active) setState({ status: 'error', creators: [], activity: [] });
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return (
    <>
      <section className="homeSection homeCreators" id="creators" aria-labelledby="creators-title">
        <div className="homeSectionHeading">
          <div>
            <p className="homeEyebrow">CREATOR CÔNG KHAI</p>
            <h2 id="creators-title">Khám phá Creator đã được duyệt</h2>
          </div>
          <p>
            Chỉ hồ sơ đang hoạt động, Creator đã được duyệt và có Hoạt động công khai đã
            qua kiểm duyệt mới xuất hiện tại đây.
          </p>
        </div>

        {state.status === 'loading' && state.creators.length === 0 ? (
          <div className="homeCreatorGrid" aria-busy="true" aria-label="Đang tải Creator">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="homeCreatorCard homeSkeleton" key={index} />
            ))}
          </div>
        ) : null}

        {state.status === 'error' ? (
          <HomepageState
            action="Thử tải lại"
            description="Dữ liệu công khai chưa thể tải. Trang chủ vẫn hoạt động và không hiển thị dữ liệu mẫu thay cho người dùng thật."
            onAction={reload}
            title="Chưa thể tải Creator"
          />
        ) : null}

        {state.status === 'ready' && state.creators.length === 0 ? (
          <HomepageState
            description="Khi có Creator thật đáp ứng đầy đủ điều kiện duyệt và quyền công khai, hồ sơ sẽ xuất hiện tại khu vực này."
            title="Chưa có Creator công khai"
          />
        ) : null}

        {state.creators.length > 0 ? (
          <div className="homeCreatorGrid">
            {state.creators.map((creator) => (
              <a
                className="homeCreatorCard"
                href={`/hoat-dong?u=${encodeURIComponent(creator.username)}`}
                key={creator.creator_id}
              >
                {creator.avatarUrl ? (
                  <img
                    alt={`Ảnh đại diện của ${creator.display_name}`}
                    className="homeCreatorAvatar"
                    loading="lazy"
                    src={creator.avatarUrl}
                  />
                ) : (
                  <span className="homeCreatorAvatar homeCreatorAvatarFallback" aria-hidden="true">
                    {creator.display_name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="homeCreatorVerified" aria-label="Creator đã được duyệt">
                  ✓
                </span>
                <strong>{creator.display_name}</strong>
                <small>@{creator.username}</small>
                <p>{creator.creator_bio || 'Creator đang xây dựng cộng đồng trên MyFan.'}</p>
                <span className="homeCreatorMeta">
                  {creator.public_activity_count.toLocaleString('vi-VN')} Hoạt động công khai
                </span>
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {state.activity.length > 0 ? (
        <section className="homeSection homeActivity" id="community" aria-labelledby="activity-title">
          <div className="homeSectionHeading">
            <div>
              <p className="homeEyebrow">NỘI DUNG CỘNG ĐỒNG</p>
              <h2 id="activity-title">Hoạt động công khai mới nhất</h2>
            </div>
            <p>
              Nội dung chỉ xuất hiện sau khi bài, Creator và ảnh liên quan đều đạt điều kiện
              công khai của hệ thống.
            </p>
          </div>
          <div className="homeActivityGrid">
            {state.activity.map((post) => (
              <article className="homeActivityCard" key={post.post_id}>
                <header>
                  {post.avatarUrl ? (
                    <img
                      alt=""
                      className="homeActivityAvatar"
                      loading="lazy"
                      src={post.avatarUrl}
                    />
                  ) : (
                    <span className="homeActivityAvatar homeCreatorAvatarFallback" aria-hidden="true">
                      {post.display_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <strong>{post.display_name}</strong>
                    <small>
                      @{post.username} · {formatPublicDate(post.published_at)}
                    </small>
                  </div>
                  <span className="homeCreatorVerified" aria-label="Creator đã được duyệt">
                    ✓
                  </span>
                </header>
                <p className="homeActivityBody">
                  {truncatePublicHomepageText(post.body, 220)}
                </p>
                {post.content_type === 'image' ? (
                  post.mediaUrl ? (
                    <img
                      alt={`Ảnh Hoạt động của ${post.display_name}`}
                      className="homeActivityMedia"
                      loading="lazy"
                      src={post.mediaUrl}
                    />
                  ) : (
                    <div className="homeActivityMediaFallback">Ảnh công khai đang được tải</div>
                  )
                ) : null}
                {post.content_type === 'video' && post.external_url ? (
                  <a
                    className="homeVideoCard"
                    href={post.external_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {post.external_provider === 'youtube' && post.external_video_id ? (
                      <img
                        alt="Ảnh xem trước YouTube"
                        loading="lazy"
                        src={getYouTubeThumbnail(post.external_video_id)}
                      />
                    ) : (
                      <span className="homeVideoFallback">OF.TV</span>
                    )}
                    <span>
                      <strong>{post.external_provider === 'youtube' ? 'YouTube' : 'OF.TV'}</strong>
                      <small>Mở liên kết ngoài ›</small>
                    </span>
                  </a>
                ) : null}
                <footer>
                  <a href={`/hoat-dong?u=${encodeURIComponent(post.username)}`}>
                    Xem Hoạt động của Creator
                  </a>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function HomepageState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="homeDataState">
      <strong>{title}</strong>
      <p>{description}</p>
      {action && onAction ? (
        <button className="homeSecondaryButton" onClick={onAction} type="button">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function formatPublicDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
