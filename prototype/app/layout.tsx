import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Footage Sync — Premiere UI Prototype",
    description: "An interactive Adobe Premiere-style UI prototype for Footage Sync.",
    openGraph: {
      title: "Footage Sync",
      description: "Premiere UI prototype",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og-v3.png`, width: 1536, height: 1024, alt: "Footage Sync Premiere UI prototype" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Footage Sync",
      description: "Premiere UI prototype",
      images: [`${origin}/og-v3.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
