import { useEffect, useRef } from 'react';

/**
 * Opens a <dialog> as a modal when the component mounts and moves focus to
 * the given element. Attach the returned ref to the <dialog>.
 *
 * @param {import('react').RefObject<HTMLElement | null>} initialFocusRef
 */
export function useModalDialog(initialFocusRef) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    const dialog = dialogRef.current;

    // StrictMode runs effects twice; showModal() must not be called on an open dialog.
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    initialFocusRef.current?.focus();
  }, [initialFocusRef]);

  return dialogRef;
}
