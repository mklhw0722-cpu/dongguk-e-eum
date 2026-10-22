import type { NextConfig } from "next";

const isProdPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isProdPages ? "export" : undefined,
  basePath: isProdPages ? "/dongguk-e-eum" : "",
  assetPrefix: isProdPages ? "/dongguk-e-eum/" : undefined,
  trailingSlash: true,
  // 개발 서버 왼쪽 아래의 Next.js 표시(N 버튼)를 숨긴다. 배포된 사이트에는 원래 나타나지 않는다.
  devIndicators: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
