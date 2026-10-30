import passport from 'passport';
import passportLocal from 'passport-local';

import { getUserByEmail, getUserById } from '../dao/auth-dao.js';
import { verifyPassword } from '../services/password.js';

const LocalStrategy = passportLocal.Strategy;

passport.use(
  new LocalStrategy(
    { usernameField: 'email' },
    async function verify(email, password, callback) {
      try {
        const user = await getUserByEmail(email);

        if (!user || !(await verifyPassword(password, user.password_hash))) {
          return callback(null, false, {
            message: 'Incorrect email or password.',
          });
        }

        // Never expose the password hash in the authenticated user.
        const authenticatedUser = {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        };

        return callback(null, authenticatedUser);
      } catch (error) {
        return callback(error);
      }
    },
  ),
);

// Store only the user ID; retrieve current account data on each request.
passport.serializeUser((user, callback) => {
  callback(null, user.id);
});

passport.deserializeUser(
  /**
   * @param {number} id
   * @param {(error: unknown, user?: Express.User | false | null) => void} callback
   */
  async (id, callback) => {
    try {
      const user = await getUserById(id);

      callback(null, user ?? false);
    } catch (error) {
      callback(error, false);
    }
  },
);

export default passport;
