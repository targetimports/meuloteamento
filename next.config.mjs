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
  experimental: {
    serverActions: {
      // O padrão é 1 MB e os uploads passam por server action: sem isto, toda
      // foto acima de 1 MB falhava, mesmo com a tela prometendo 8 MB. 30 MB é
      // o mesmo teto que o nginx já aplica em client_max_body_size — subir
      // daqui sem subir lá só trocaria o erro de lugar.
      bodySizeLimit: '30mb',
    },
  },
};

export default nextConfig;
