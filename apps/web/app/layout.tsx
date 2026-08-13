import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "@proofsheet/ui/tokens.css";
import "./globals.css";
import "./shell.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  weight: ["700", "800"],
});
const body = Geist({ subsets: ["latin"], variable: "--font-body-loaded", weight: ["400", "500", "600"] });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono-loaded", weight: ["400", "500", "600"] });

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
