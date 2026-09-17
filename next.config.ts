import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The UI accepts files up to 20 MB; leave room for multipart metadata.
      bodySizeLimit: "22mb",
    },
  },
};

export default nextConfig;
