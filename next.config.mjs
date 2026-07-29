/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite buildar num diretorio separado (deploy/deploy.sh usa isso para nao
  // sobrescrever o .next que o servidor esta servindo). Padrao continua .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      { hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
