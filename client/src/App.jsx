import { useEffect } from "react";
import { Alert } from "react-bootstrap";
import { Link, Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext.jsx";
import { useAuthLogic } from "./hooks/useAuthLogic.js";
import HomePage from "./pages/HomePage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import StaffLoginPage from "./pages/StaffLoginPage.jsx";
import StaffCapacityPage from "./pages/StaffCapacityPage.jsx";
import StaffBookingPage from "./pages/StaffBookingPage.jsx";
import MyBookingsPage from "./pages/MyBookingsPage.jsx";
import StaffAccessNotice from "./components/auth/StaffAccessNotice.jsx";

/**
 * @param {Object} props
 * @param {string} props.message
 * @param {() => void} props.onClose
 */
function AuthFeedback({ message, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5000);

    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <Alert
      variant="success"
      className="mh-floating-alert"
      dismissible
      closeLabel="Close notification"
      onClose={onClose}
      role="status"
    >
      {message}
    </Alert>
  );
}

function App() {
  const auth = useAuthLogic();

  const { pathname } = useLocation();

  const isStaff =
    auth.user?.role === "employee" || auth.user?.role === "warden";

  const isStaffPage =
    pathname === "/staff/capacity" ||
    pathname === "/staff/bookings" ||
    pathname === "/staff/login";

  if (auth.isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  return (
    <AuthProvider value={auth}>
      {auth.feedbackMessage && (
        <AuthFeedback
          message={auth.feedbackMessage}
          onClose={auth.clearFeedbackMessage}
        />
      )}

      {isStaff && !isStaffPage ? (
        <StaffAccessNotice />
      ) : (
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/menu" element={<MenuPage />} />

          <Route path="/staff/login" element={<StaffLoginPage />} />

          <Route path="/staff/capacity" element={<StaffCapacityPage />} />

          <Route path="/staff/bookings" element={<StaffBookingPage />} />

          <Route path="/my-bookings" element={<MyBookingsPage />} />

          <Route
            path="*"
            element={
              <main>
                <h1>Page not found</h1>

                <Link to="/">Return to home</Link>
              </main>
            }
          />
        </Routes>
      )}
    </AuthProvider>
  );
}

export default App;
