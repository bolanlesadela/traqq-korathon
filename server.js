import app from './src/app.js';
import { env } from './src/config/env.js';

const server = app.listen(env.port, () => {
  console.log(`
  ████████╗██████╗  █████╗  ██████╗  ██████╗
     ██╔══╝██╔══██╗██╔══██╗██╔═══██╗██╔═══██╗
     ██║   ██████╔╝███████║██║   ██║██║   ██║
     ██║   ██╔══██╗██╔══██║██║▄▄ ██║██║▄▄ ██║
     ██║   ██║  ██║██║  ██║╚██████╔╝╚██████╔╝
     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══▀▀═╝  ╚══▀▀═╝

  🚀 Server running on port ${env.port}
  🌍 Environment: ${env.nodeEnv}
  🔗 Health: http://localhost:${env.port}/health
  `);
});

// Graceful shutdown — don't kill active connections abruptly
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Catch unhandled promise rejections — log and exit
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  server.close(() => process.exit(1));
});
