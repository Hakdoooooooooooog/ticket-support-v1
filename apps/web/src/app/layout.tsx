import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@app/providers";
import { ReactNode } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TicketSupport - Enterprise IT Helpdesk",
  description: "Modern ticket management and customer support platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem('ts_theme');
                  var mql = window.matchMedia('(prefers-color-scheme: dark)');
                  var isDark = stored === 'dark' || ((!stored || stored === 'system') && mql.matches);
                  var root = document.documentElement;
                  if (isDark) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                  } else {
                    root.classList.remove('dark');
                    root.classList.add('light');
                  }
                } catch (err) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-spruce-50 text-spruce-950 dark:bg-spruce-950 dark:text-spruce-50 transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
