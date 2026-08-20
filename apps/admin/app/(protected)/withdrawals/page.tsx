import type { Metadata } from 'next';
import { KycWithdrawalOperationsClient } from '../../kyc-withdrawal-operations/kyc-withdrawal-operations-client';

export const metadata: Metadata = {
  title: 'KYC và rút tiền — Chon.Love Admin',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <KycWithdrawalOperationsClient />;
}
