import { useState } from "react";

import ScheduleCopyHistoryModal from "./ScheduleCopyHistoryModal.jsx";

/** @param {{ onAddSchedule: () => void }} props */
export default function ScheduleCopyActions({ onAddSchedule }) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="cap-schedule-copy-actions">
      <button
        type="button"
        className="cap-outline"
        aria-haspopup="dialog"
        onClick={() => setShowHistory(true)}
      >
        <i className="bi bi-clock-history" aria-hidden="true" />
        Schedule copies
      </button>

      {showHistory && (
        <ScheduleCopyHistoryModal
          onHide={() => setShowHistory(false)}
          onAddSchedule={() => {
            setShowHistory(false);
            onAddSchedule();
          }}
        />
      )}
    </div>
  );
}
