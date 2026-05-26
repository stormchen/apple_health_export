/** @type {import('next').NextConfig} */
const nextConfig = {
  // 原生模組和系統監控套件不由 Next.js 打包
  serverExternalPackages: ['better-sqlite3', 'chokidar', 'node-cron'],
};

export default nextConfig;
