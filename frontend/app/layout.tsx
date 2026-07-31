import type { Metadata } from "next";

import "./globals.css";
import { Toaster } from "sonner";

const geistSansVariable = "font-sans";
const geistMonoVariable = "font-mono";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "konn3ct";

export const metadata: Metadata = {
  title: `${appName} - Premium Video Conferencing`,
  description: "Modern video conferencing, webinars, and recording platform.",
  icons: {
    icon: "/icon.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html
        lang="en"
        className={`${geistSansVariable} ${geistMonoVariable} h-full antialiased`}
      >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
