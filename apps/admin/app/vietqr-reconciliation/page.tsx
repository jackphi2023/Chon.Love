import type { Metadata } from 'next';
import { VietqrReconciliationClient } from './vietqr-reconciliation-client';

export const metadata: Metadata = {
  title: 'Đối soát VietQR — MyFan Admin',
  robots: { index: false, follow: false },
};

export default function VietqrReconciliationPage() {
  return <main className="adminPage"><VietqrReconciliationClient /></main>;
}
