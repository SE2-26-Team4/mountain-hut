import { Col, Row, Spinner } from 'react-bootstrap';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';
import useStaffCapacity from '../hooks/useStaffCapacity.js';
import AssignTablesModal from '../components/capacity/AssignTablesModal.jsx';
import CapacityFormModal from '../components/capacity/CapacityFormModal.jsx';
import StaffDateSelector from '../components/capacity/StaffDateSelector.jsx';
import StaffHeader from '../components/capacity/StaffHeader.jsx';
import StaffSidebar from '../components/capacity/StaffSidebar.jsx';
import StaffTablesPanel from '../components/capacity/StaffTablesPanel.jsx';
import StaffTimeSlotsPanel from '../components/capacity/StaffTimeSlotsPanel.jsx';
import Alert from '../components/common/AutoDismissAlert.jsx';

/**
 * @typedef {import('../API/session-api.js').SessionUser} SessionUser
 */

function StaffCapacityPage() {
  const { user, isLoading, handleLogout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await handleLogout();
    navigate('/', { replace: true });
  };

  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  if (!user) {
    return <Navigate to="/staff/login" replace />;
  }

  if (user.role !== 'employee' && user.role !== 'warden') {
    return <Navigate to="/" replace />;
  }

  return (
    <StaffCapacityContent
      user={user}
      onLogout={handleSignOut}
    />
  );
}

/**
 * @param {Object} props
 * @param {SessionUser} props.user
 * @param {() => Promise<void>} props.onLogout
 */
function StaffCapacityContent({ user, onLogout }) {
  const staff = useStaffCapacity();

  return (
    <Row className="g-0 cap-app">
      <Col xs={12} className="cap-sidebar-column">
        <StaffSidebar onLogout={onLogout} />
      </Col>

      <Col
        as="main"
        className="cap-main"
        aria-label="Dining capacity"
      >
        <StaffHeader
          user={user}
          onLogout={onLogout}
        />

        <div className="cap-content">
          <StaffDateSelector />

          {staff.errorMessage &&
            !staff.isAssignmentModalOpen &&
            !staff.isTableModalOpen &&
            !staff.isSlotModalOpen && (
              <Alert variant="danger">
                {staff.errorMessage}
              </Alert>
            )}

          {staff.feedbackMessage && (
            <Alert variant="success">
              {staff.feedbackMessage}
            </Alert>
          )}

          {staff.isLoading ? (
            <div
              className="cap-loading d-flex align-items-center"
              role="status"
            >
              <Spinner animation="border" aria-hidden="true" />

              <span>Loading capacity configuration…</span>
            </div>
          ) : (
            <Row className="g-0 cap-columns">
              <Col xs={12} className="cap-tables-column">
                <StaffTablesPanel
                  tables={staff.diningTables}
                  onAdd={staff.openNewTableForm}
                  onEdit={staff.startEditingTable}
                />
              </Col>

              <Col xs={12} className="cap-slots-column">
                <StaffTimeSlotsPanel
                  slots={staff.mealSlots}
                  tables={staff.diningTables}
                  onAdd={staff.openNewSlotForm}
                  onEdit={staff.startEditingSlot}
                  onAssign={staff.openAssignmentModal}
                />
              </Col>
            </Row>
          )}

          <AssignTablesModal
            show={staff.isAssignmentModalOpen}
            onHide={staff.closeAssignmentModal}
            slot={staff.selectedSlot}
            tables={staff.diningTables}
            selectedIds={staff.selectedTableIds}
            onToggle={staff.toggleTableAssignment}
            onSave={staff.saveAssignments}
            saving={staff.isSaving}
            error={staff.errorMessage}
            capacity={staff.assignedCapacity}
          />

          <CapacityFormModal
            kind="table"
            show={staff.isTableModalOpen}
            onHide={staff.closeTableModal}
            form={staff.tableForm}
            onChange={staff.updateTableField}
            onSubmit={staff.handleTableSubmit}
            editing={staff.editingTableId !== null}
            saving={staff.isSaving}
            error={staff.errorMessage}
          />

          <CapacityFormModal
            kind="slot"
            show={staff.isSlotModalOpen}
            onHide={staff.closeSlotModal}
            form={staff.slotForm}
            onChange={staff.updateSlotField}
            onSubmit={staff.handleSlotSubmit}
            editing={staff.editingSlotId !== null}
            saving={staff.isSaving}
            error={staff.errorMessage}
          />
        </div>
      </Col>
    </Row>
  );
}

export default StaffCapacityPage;
