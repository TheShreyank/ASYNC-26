import { Figtree } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "CasualHealth | Small habits. Bigger you.",
  description:
    "Track daily habits with voice check-ins, AI-assisted transcription, and reflective summaries.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}