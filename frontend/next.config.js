/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { ignored: /node_modules/ };
    }
    return config;
  },
};

module.exports = nextConfig;
