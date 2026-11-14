import { useState } from "react";
import { Col, Row } from "react-bootstrap";
import { Navigate, useNavigate } from "react-router-dom";

import StaffSidebar from "../components/capacity/StaffSidebar.jsx";
import { useAuth } from "../contexts/auth-context.js";
import StaffBookingForm from "../components/staff-booking/StaffBookingForm.jsx";

export default function StaffBookingPage() {
  const { user, isLoading, handleLogout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const handleSignOut = async () => {
    await handleLogout();
    navigate("/", { replace: true });
  };

  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  if (!user) {
    return <Navigate to="/staff/login" replace />;
  }

  if (user.role !== "employee" && user.role !== "warden") {
    return <Navigate to="/" replace />;
  }

  return (
    <Row
      className={`g-0 cap-app${sidebarCollapsed ? " cap-sidebar-collapsed" : ""}`}
    >
      <Col id="staff-sidebar" xs={12} className="cap-sidebar-column">
        <StaffSidebar user={user} onLogout={handleSignOut} />
      </Col>

      <Col as="main" className="cap-main" aria-labelledby="staff-booking-title">
        <div className="cap-navigation-toolbar">
          <button
            type="button"
            className="cap-sidebar-toggle"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={
              sidebarCollapsed ? "Open navigation" : "Close navigation"
            }
            aria-expanded={!sidebarCollapsed}
            aria-controls="staff-sidebar"
          >
            <i
              className={`bi ${sidebarCollapsed ? "bi-layout-sidebar" : "bi-chevron-left"}`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="cap-content staff-booking-content">
          <section className="cap-panel staff-booking-panel">
            <div className="cap-panel-heading">
              <h1 id="staff-booking-title">Create Booking</h1>
              <p>Book a table on behalf of a hiker.</p>
            </div>
            <StaffBookingForm onCancel={() => navigate("/staff/capacity")} />
          </section>
        </div>
      </Col>
    </Row>
  );
}
