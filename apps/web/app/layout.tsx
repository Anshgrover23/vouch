import type { Metadata } from "next";
import localFont from "next/font/local";
import "@proofsheet/ui/tokens.css";
import "./globals.css";
import "./shell.css";

const display = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  variable: "--font-display-loaded",
  weight: "200 800",
  display: "swap",
});
const body = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-body-loaded",
  weight: "100 900",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-mono-loaded",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vouch — split the receipt, not the friendship",
  description: "Upload the crumpled receipt. Housemates tap the lines they actually owe. Everyone vouches. Nobody argues about organic blueberries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
