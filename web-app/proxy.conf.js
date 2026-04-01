const target = process.env.TRAINER_API_TARGET || "https://localhost:9090";
const proxyConfig = { target, secure: false, changeOrigin: true };

module.exports = {
  "/api/**": proxyConfig,
  "/health": proxyConfig,
};
