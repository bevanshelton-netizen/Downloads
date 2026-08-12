import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ubuntu Africa Cloud",
  description: "Affordable managed digital infrastructure for African organisations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
