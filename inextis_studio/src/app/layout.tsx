import type { Metadata, Viewport } from "next";
import { Inter, Jost } from "next/font/google";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["300", "400", "500"] });

export const metadata: Metadata = {
  title: "Inextis AI Studio",
  description: "AI tools for booth design, lead generation and event screens.",
  icons: { icon: "/brand/icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f6f4f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jost.variable} antialiased`}>
      <body className="min-h-screen">
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        <main className="lg:pl-[248px] pb-24 lg:pb-0">
          <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
