import { Col, Row } from 'react-bootstrap';

import MountainLogo from '../common/MountainLogo.jsx';

/**
 * Full-page account card with the same look as the staff sign-in page,
 * used by the pages where hikers choose a new password.
 *
 * @param {Object} props
 * @param {string} props.titleId - Id of the page heading inside children.
 * @param {import('react').ReactNode} props.children
 * @param {import('react').ReactNode} [props.footer] - Shown below the form.
 */
export default function AuthPageLayout({ titleId, children, footer }) {
  return (
    <Row
      as="main"
      className="g-0 align-items-center justify-content-center mh-staff-login-page"
    >
      <Col
        as="section"
        xs={12}
        className="mh-staff-login-card"
        aria-labelledby={titleId}
      >
        <div className="mh-auth-card">
          <div className="mh-auth-brand">
            <MountainLogo />

            <span>MOUNTAIN HUT</span>
          </div>

          {children}
        </div>

        {footer}
      </Col>
    </Row>
  );
}
