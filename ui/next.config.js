const isTauriBuild = process.env.TAURI_BUILD === "1";

const nextConfig = {
  ...(isTauriBuild && {
    output:       "export",
    trailingSlash: true,
  }),
  images:    { unoptimized: true },
  eslint:    { ignoreDuringBuilds: true },
  typescript:{ ignoreBuildErrors: false },
  transpilePackages: ['@local-res/shared'],
};

module.exports = nextConfig;

