import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '10.132.61.206',
    '10.132.61.206:3000',
    '10.91.1.43',
    '10.91.1.43:3000',
    '192.168.1.19',
    '192.168.1.19:3000',
    'localhost',
    'localhost:3000',
  ],
};

export default nextConfig;
