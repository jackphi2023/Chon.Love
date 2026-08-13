import type { Metadata } from 'next';
import { ActivityModerationClient } from './activity-moderation-client';

export const metadata: Metadata = {
  title: 'Kiểm duyệt nội dung legacy — Luxy.Love Admin',
  robots: { index: false, follow: false },
};

export default function ActivityModerationPage() {
  return <main className="adminPage"><ActivityModerationClient /></main>;
}
