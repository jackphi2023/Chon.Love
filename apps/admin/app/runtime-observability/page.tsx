import type { Metadata } from 'next';
import { RuntimeObservabilityClient } from './runtime-observability-client';

export const metadata: Metadata = {
  title: 'Runtime Observability — MyFan Admin',
  robots: { index: false, follow: false },
};

export default function RuntimeObservabilityPage() {
  return <main className="adminPage"><RuntimeObservabilityClient /></main>;
}
