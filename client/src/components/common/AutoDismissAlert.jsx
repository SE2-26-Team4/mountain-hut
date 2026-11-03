import { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

/**
 * @param {import('react-bootstrap').AlertProps & {
 *   children?: import('react').ReactNode,
 *   timeout?: number
 * }} props
 */
export default function AutoDismissAlert({
  children,
  timeout = 5000,
  ...props
}) {
  const [visibility, setVisibility] = useState({
    children,
    timeout,
    show: true,
  });

  if (
    visibility.children !== children ||
    visibility.timeout !== timeout
  ) {
    setVisibility({
      children,
      timeout,
      show: true,
    });
  }

  useEffect(() => {
    if (timeout <= 0) return;

    const timer = setTimeout(() => {
      setVisibility({
        children,
        timeout,
        show: false,
      });
    }, timeout);

    return () => clearTimeout(timer);
  }, [children, timeout]);

  return (
    <Alert
      {...props}
      show={visibility.show}
      dismissible
      closeLabel="Close alert"
      onClose={() =>
        setVisibility({
          children,
          timeout,
          show: false,
        })
      }
      className={`mh-floating-alert ${props.className ?? ''}`}
    >
      {children}
    </Alert>
  );
}