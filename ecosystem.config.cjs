module.exports = {
  apps: [
    {
      name:        'pr-task',
      script:      'server/index.js',
      cwd:         '/root/main-app/pr-task',
      interpreter: 'node',

      autorestart:   true,
      watch:         false,
      max_restarts:  10,
      restart_delay: 3000,

      env: {
        NODE_ENV: 'production'
      },

      out_file:        '/root/main-app/pr-task/logs/pm2-out.log',
      error_file:      '/root/main-app/pr-task/logs/pm2-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      true
    }
  ]
}
