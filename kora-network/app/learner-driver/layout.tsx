import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Learner Driver SA | Learn Today. Drive Tomorrow.",
  description: "Prepare for your South African learner's licence with road signs, rules of the road, mock tests, simulator practice and support for all 12 official South African languages.",
  alternates: { canonical: "https://kora-network.vercel.app/learner-driver" },
  openGraph: {
    title: "Learner Driver SA | Learn Today. Drive Tomorrow.",
    description: "Motorcycles • Code 08 • Code 10 • Code 14 • Mock tests • Road signs • Simulators • 12 official South African languages.",
    url: "https://kora-network.vercel.app/learner-driver",
    siteName: "Learner Driver SA",
    images: [{ url: "/images/learner-driver-sa-ad.svg", width: 1080, height: 1350, alt: "Learner Driver SA learner's licence preparation advert" }],
    locale: "en_ZA",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Learner Driver SA",
    description: "Learn today. Drive tomorrow.",
    images: ["/images/learner-driver-sa-ad.svg"]
  },
  robots: { index: true, follow: true }
};

export default function LearnerDriverLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
