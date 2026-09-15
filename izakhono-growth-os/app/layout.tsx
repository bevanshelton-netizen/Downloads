import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:"IZAKHONO GROWTH OS",
  description:"AI-assisted multilingual marketing command centre for paid ads, organic social, landing pages, leads, attribution and compliance."
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
