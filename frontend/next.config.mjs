/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: `next build` writes plain HTML/JS to out/, which is uploaded to S3 behind CloudFront.
  output: "export",
  // S3 + CloudFront serve /accounts/index.html for /accounts/ without extra routing rules.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
