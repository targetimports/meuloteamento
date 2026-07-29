module.exports = {
  apps: [
    {
      name: 'meuloteamento',
      cwd: '/var/www/meuloteamento',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      out_file: '/var/log/meuloteamento/out.log',
      error_file: '/var/log/meuloteamento/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
