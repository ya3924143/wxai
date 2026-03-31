module.exports = {
  apps: [
    {
      name: 'wxai',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      error_file: '/dev/null',
      out_file: '/dev/null',
    },
  ],
}
