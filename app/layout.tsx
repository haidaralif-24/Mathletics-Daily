import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShellSkeleton } from "@/components/app-shell";
import { AppShellUser } from "@/components/app-shell-user";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Mathletics Daily",
    template: "%s · Mathletics Daily",
  },
  description:
    "Satu soal matematika setiap hari untuk klub matematika sekolah. Soal rilis pukul 04.00 WIB dan terbuka selama 24 jam.",
  applicationName: "Mathletics Daily",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={<AppShellSkeleton />}>
            <AppShellUser>{children}</AppShellUser>
          </Suspense>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}