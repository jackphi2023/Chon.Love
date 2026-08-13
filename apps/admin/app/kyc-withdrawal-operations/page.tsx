import type { Metadata } from 'next';
import { KycWithdrawalOperationsClient } from './kyc-withdrawal-operations-client';

export const metadata: Metadata = {
  title: 'KYC và rút tiền — Luxy.Love Admin',
  robots: { index: false, follow: false },
};

export default function KycWithdrawalOperationsPage() {
  return <main className="adminPage"><KycWithdrawalOperationsClient /></main>;
}
