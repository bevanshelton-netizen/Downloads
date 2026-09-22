import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'YHVH GOSPEL TV' },
  applicationName: 'YHVH GOSPEL TV',
};

export default function GospelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`.top, body > footer, .autoAiPromo, .globalShareButton { display:none !important; } body { background:#07111f; }`}</style>
      {children}
    </>
  );
}
