import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ShareButton from "./share-button";
import LearnerDriverPromo from "./learner-driver-promo";

export const metadata: Metadata = {
  title:"IZAKHONO GROWTH OS",
  description:"AI-assisted multilingual marketing command centre for paid ads, organic social, landing pages, leads, attribution and compliance."
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><Script id="izakhono-portfolio-growth" src="https://bevanshelton-netizen.github.io/Downloads/portfolio-growth/bridge.js" data-platform="growth-os" strategy="afterInteractive" />{children}<ShareButton /><LearnerDriverPromo /></body></html>;
}
