const path = require('path');

module.exports = {
  apps: [
    {
      name: 'kardex-backend',
      cwd: path.join(__dirname, 'kardex-node'),
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5005,
      },
      error_file: path.join(__dirname, 'logs', 'backend-error.log'),
      out_file: path.join(__dirname, 'logs', 'backend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      time: true,
    },
    {
      name: 'kardex-frontend',
      cwd: path.join(__dirname, 'kardex-next'),
      script: path.join(__dirname, 'kardex-next', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: path.join(__dirname, 'logs', 'frontend-error.log'),
      out_file: path.join(__dirname, 'logs', 'frontend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      time: true,
    },
  ],
};

