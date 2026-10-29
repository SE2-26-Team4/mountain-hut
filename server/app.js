import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth-routes.js';
import { sessionMiddleware } from './middleware/session.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(sessionMiddleware);

app.use('/api', authRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'this is the mountain hut server'
  });
});

export default app;