// PM2 Ecosystem Configuration
// 使用方式：pm2 start deploy/ecosystem.config.cjs --env production
module.exports = {
  apps: [
    {
      name: 'fusheng-api',
      cwd: '/var/www/fusheng/server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/fusheng/error.log',
      out_file: '/var/log/fusheng/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
