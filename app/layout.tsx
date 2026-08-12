import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

/** No `next/font/google` — build works offline / without fonts.googleapis.com (see globals.css stacks). */

export const metadata: Metadata = {
  title: "Quality Management System",
  description: "Professional Quality Management System",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
