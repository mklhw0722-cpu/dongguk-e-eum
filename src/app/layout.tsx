import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "동국e음 (Dongguk e-eum) | 동국대학교 교육학과 종합 소통 플랫폼",
  description:
    "동국대학교 교육학과 재학생, 졸업생, 교수진을 위한 폐쇄형 학과 종합 소통·진로·학업 플랫폼 (프로토타입)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d121c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 본문 서체: Pretendard (필요한 글자만 내려받는 dynamic subset) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">
        <AppProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
