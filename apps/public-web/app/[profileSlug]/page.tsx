import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPublicAvatarUrl, getPublicChonProfile, parsePublicProfileSlug } from '../../src/lib/public-profile';
import './profile.css';

type Props = { params: Promise<{ profileSlug: string }> };
const fallbackDescription = 'Chon.Love là nền tảng hẹn hò dành cho người dùng thật và văn minh, hướng tới các mối quan hệ lành mạnh, chất lượng và xứng tầm.';

function profileDescription(profile: Awaited<ReturnType<typeof getPublicChonProfile>>): string {
  const raw = profile?.headline?.trim() || profile?.bio?.trim() || fallbackDescription;
  return raw.length > 158 ? `${raw.slice(0, 155).trimEnd()}…` : raw;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profileSlug } = await params;
  const code = parsePublicProfileSlug(profileSlug);
  if (!code) return { title: 'Không tìm thấy thành viên | Chon.Love', robots: { index: false, follow: false } };
  const profile = await getPublicChonProfile(code);
  if (!profile) return { title: 'Không tìm thấy thành viên | Chon.Love', robots: { index: false, follow: false } };
  const name = profile.display_name?.trim() || 'Thành viên Chon.Love';
  const description = profileDescription(profile);
  const avatarUrl = profile.avatar_available ? getPublicAvatarUrl(code) : null;
  return {
    title: `${name} | Chon.Love`,
    description,
    alternates: { canonical: `/${profileSlug}` },
    openGraph: {
      title: `${name} | Chon.Love`,
      description,
      type: 'profile',
      locale: 'vi_VN',
      url: `/${profileSlug}`,
      ...(avatarUrl ? { images: [{ url: avatarUrl, alt: `Ảnh đại diện của ${name}` }] } : {}),
    },
    twitter: {
      card: avatarUrl ? 'summary_large_image' : 'summary',
      title: `${name} | Chon.Love`,
      description,
      ...(avatarUrl ? { images: [avatarUrl] } : {}),
    },
  };
}

export default async function PublicMemberPage({ params }: Props) {
  const { profileSlug } = await params;
  const code = parsePublicProfileSlug(profileSlug);
  if (!code) notFound();
  const profile = await getPublicChonProfile(code);
  if (!profile) notFound();
  const name = profile.display_name?.trim() || 'Thành viên Chon.Love';
  const avatarUrl = profile.avatar_available ? getPublicAvatarUrl(code) : null;
  const location = profile.province_name || 'Việt Nam';
  const memberSince = new Date(profile.member_since).getFullYear();
  const personData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: profileDescription(profile),
    homeLocation: { '@type': 'Place', name: location },
    ...(avatarUrl ? { image: avatarUrl } : {}),
  };

  return (
    <main className="memberPublicPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personData) }} />
      <article className="memberPublicCard">
        <div className="memberPublicPhoto">
          {avatarUrl ? (
            <Image
              alt={`Ảnh đại diện của ${name}`}
              height={1120}
              priority
              sizes="(max-width: 760px) 100vw, 420px"
              src={avatarUrl}
              width={840}
            />
          ) : <span className="memberPublicPlaceholder" aria-hidden="true">♥</span>}
        </div>
        <div className="memberPublicCopy">
          <p className="memberPublicEyebrow">THÀNH VIÊN CHON.LOVE · {profile.membership_tier.toUpperCase()}</p>
          <h1>{name}</h1>
          <p className="memberPublicMeta">{profile.age} tuổi · {location}{profile.height_cm ? ` · ${profile.height_cm} cm` : ''}</p>
          {profile.headline ? <p className="memberPublicHeadline">{profile.headline}</p> : null}
          {profile.bio ? <p className="memberPublicBio">{profile.bio}</p> : null}
          <div className="memberPublicFacts">
            {profile.occupation ? <span>{profile.occupation}</span> : null}
            {profile.looking_for ? <span>{profile.looking_for}</span> : null}
            {profile.interests.slice(0, 4).map((interest) => <span key={interest}>{interest}</span>)}
          </div>
          <a className="memberPublicCta" href="/?intent=signup">Tham gia Chon.Love</a>
          <p className="memberPublicNote">Thành viên từ {memberSince}. Trang công khai không hiển thị ngày sinh đầy đủ, vị trí chính xác, ảnh riêng tư hay thông tin xác minh nội bộ.</p>
        </div>
      </article>
    </main>
  );
}
