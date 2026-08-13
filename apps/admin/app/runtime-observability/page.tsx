import type { Metadata } from 'next';
import { RuntimeObservabilityClient } from './runtime-observability-client';

export const metadata: Metadata = {
  title: 'Runtime Observability — Luxy.Love Admin',
  robots: { index: false, follow: false },
};

export default function RuntimeObservabilityPage() {
  return <main className="adminPage"><RuntimeObservabilityClient /></main>;
}
