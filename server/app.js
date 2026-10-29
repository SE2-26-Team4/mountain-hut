import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import session from 'express-session';

import passport from './config/passport.js';
import authRoutes from './routes/auth-routes.js';

// Create the Express application separately from the server listener.
const app = express();

/* JSON AND CORS */

app.use(express.json());

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
};

app.use(cors(corsOptions));

/* SESSION CONFIGURATION */

// Configure session-based authentication.
const sessionSecret =
  process.env.SESSION_SECRET ?? 'mountain-hut-local-development-secret';

// Require an explicit session secret in production.
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

// Initialize Passport and restore authenticated sessions.
app.use(passport.initialize());
app.use(passport.session());

/* HEALTH CHECK */

// Preserve the existing health check response.
app.get('/api/health', (_req, res) => {
  return res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

/* AUTHENTICATION ROUTES */

// Login, logout, and current-session endpoints.
app.use('/api', authRoutes);

/* ROOT ROUTE */

// Preserve the original root endpoint during development.
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_req, res) => {
    return res.status(200).json({
      message: 'this is the mountain hut server',
    });
  });
}

/* FRONTEND STATIC FILES */

// Serve the React production build when running with Docker.
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../client/dist');

  app.use(express.static(clientDist));

  // Return React's index.html for frontend routes.
  // API requests must never fall back to React.
  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path === '/api' ||
      req.path.startsWith('/api/')
    ) {
      return next();
    }

    // Do not return index.html for missing static assets.
    if (path.extname(req.path)) {
      return next();
    }

    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
