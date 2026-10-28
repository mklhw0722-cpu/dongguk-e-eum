import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "동국e음 (Dongguk e-eum) | 동국대학교 교육학과 종합 소통 플랫폼",
  description:
    "동국대학교 교육학과 재학생, 졸업생, 교수진을 위한 폐쇄형 학과 종합 소통·진로·학업 플랫폼 (프로토타입)",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="light" style={{ colorScheme: "light" }}>
      <body className="antialiased bg-[var(--bg-main)] text-[var(--text-main)]">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
