module.exports = {
  apps: [
    {
      name:        'pr-task-manager',
      script:      'node_modules/.bin/vite',
      args:        'preview --host 0.0.0.0 --port 7465',
      cwd:         '/root/main-app/pr-task-manager',
      interpreter: 'none',

      autorestart:  true,
      watch:        false,
      max_restarts: 10,
      restart_delay: 3000,

      env: {
        NODE_ENV: 'production'
      },

      out_file:   '/root/main-app/pr-task-manager/logs/pm2-out.log',
      error_file: '/root/main-app/pr-task-manager/logs/pm2-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    }
  ]
}
