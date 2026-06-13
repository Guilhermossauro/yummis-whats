module.exports = {
  apps: [
    {
      name: 'yummis-gateway',
      script: 'backend/server.js',
      cwd: __dirname,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3060',
      },
    },
    {
      name: 'yummis-crm-dev',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host 0.0.0.0 --port 3050',
      cwd: __dirname,
      time: true,
      env: {
        NODE_ENV: 'development',
        BROWSER: 'none',
      },
    },
    {
      name: 'yummis-centralizer',
      script: 'centralizer/index.js',
      cwd: __dirname,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '8080',
        GATEWAY_URL: 'http://localhost:3060',
      },
    },
  ],
};
