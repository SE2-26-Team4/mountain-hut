import passport from "passport";
import LocalStrategy from "passport-local";

import { getUserByEmail, getUserById } from "../dao/auth-dao.js";
import { verifyPassword } from "../services/password.js";

// [Minimal login setup (backend)]: Verify email and password through the account DAO.
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async function verify(email, password, callback) {
      try {
        const user = await getUserByEmail(email);

        if (!user || !(await verifyPassword(password, user.password_hash))) {
          return callback(null, false, {
            message: "Incorrect email or password.",
          });
        }

        // [Minimal login setup (backend)]: Keep only safe account fields.
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

// [Minimal login setup (backend)]: Store only the account ID in the session.
passport.serializeUser((user, callback) => {
  callback(null, user.id);
});

// [Minimal login setup (backend)]: Restore the authenticated user for each request.
passport.deserializeUser(async (id, callback) => {
  try {
    const user = await getUserById(id);
    callback(null, user ?? false);
  } catch (error) {
    callback(error, false);
  }
});

export default passport;
