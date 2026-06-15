const isTauriBuild = process.env.TAURI_BUILD === "1";

const nextConfig = {
  ...(isTauriBuild && {
    output:       "export",
    trailingSlash: true,
  }),
  images:    { unoptimized: true },
  eslint:    { ignoreDuringBuilds: true },
  typescript:{ ignoreBuildErrors: false },
};

module.exports = nextConfig;

