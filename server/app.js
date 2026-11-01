import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import session from 'express-session';

import passport from './config/passport.js';
import authRoutes from './routes/auth-routes.js';
import capacityRoutes from './routes/capacity-routes.js';

const app = express();

/* JSON AND CORS */

app.use(express.json());

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
};

app.use(cors(corsOptions));

/* SESSION CONFIGURATION */

const sessionSecret =
  process.env.SESSION_SECRET ?? 'mountain-hut-local-development-secret';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}

app.use(
  session({
    name: 'mountain-hut.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

/* PASSPORT MIDDLEWARE */

app.use(passport.initialize());
app.use(passport.session());

/* HEALTH CHECK ROUTE */

app.get('/api/health', (_req, res) => {
  return res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

/* AUTHENTICATION ROUTES */

app.use('/api', authRoutes);

/* MEAL-SLOT AND CAPACITY ROUTES */

app.use('/api', capacityRoutes);

/* ROOT ROUTE */

if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_req, res) => {
    return res.status(200).json({
      message: 'this is the mountain hut server',
    });
  });
}

/* FRONTEND STATIC FILES */

if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../client/dist');

  app.use(express.static(clientDist));

  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path === '/api' ||
      req.path.startsWith('/api/')
    ) {
      return next();
    }

    if (path.extname(req.path)) {
      return next();
    }

    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;