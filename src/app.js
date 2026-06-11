import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import { initBot, getBot } from './services/bot.js';
import apiRoutes from './routes/api.js';
import { errorHandler } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (HTML apps)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// API routes
app.use('/api', apiRoutes);

// Bot webhook (for production)
if (NODE_ENV === 'production') {
  const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';
  app.post(WEBHOOK_PATH, (req, res) => {
    const bot = getBot();
    if (bot) {
      bot.handleUpdate(req.body, res);
    } else {
      res.status(500).json({ error: 'Bot not initialized' });
    }
  });
  console.log(`🔗 Webhook endpoint: ${WEBHOOK_PATH}`);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve HTML apps
app.get('/user.html', (req, res) => {
  res.sendFile(path.join(publicPath, 'user.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Initialize and start server
async function start() {
  try {
    console.log('📊 Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized');

    console.log('🤖 Initializing bot...');
    initBot();
    console.log('✅ Bot initialized');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📱 User MiniApp: http://localhost:${PORT}/user.html`);
      console.log(`⚙️  Admin Panel: http://localhost:${PORT}/admin.html`);
      console.log(`🤖 Bot mode: ${NODE_ENV === 'production' ? 'Webhook' : 'Polling'}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⏹️  Shutting down...');
      server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
