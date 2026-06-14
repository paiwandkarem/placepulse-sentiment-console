import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

// next/font self-hosts Plus Jakarta Sans and inlines a size-adjusted fallback, so there's no
// layout shift (CLS) and no render-blocking request to Google Fonts, which is better for Core
// Web Vitals than a <link> tag.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlacePulse | Sentiment Intelligence",
  description:
    "Customer sentiment intelligence for Queensland suburbs: themes, drivers and review evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
        <body className="min-h-full bg-gray-50 font-sans text-gray-900">
          <AppShell>{children}</AppShell>
          {/* Vercel Analytics (page/usage) and Speed Insights (Core Web Vitals). Both inject a
              tiny client script and report from the deployed app; they no-op locally. */}
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
