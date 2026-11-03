import { useState } from 'react';
import { Col, Row, Spinner } from 'react-bootstrap';

import { useAuth } from '../contexts/auth-context.js';
import LoginModal from '../components/auth/LoginModal.jsx';
import BookingForm from '../components/booking/BookingForm.jsx';
import SiteFooter from '../components/layout/SiteFooter.jsx';
import SiteHeader from '../components/layout/SiteHeader.jsx';

/**
 * @typedef {import('../API/session-api.js').LoginCredentials} LoginCredentials
 */

const diningFeatures = [
  {
    title: 'Alpine cuisine',
    description: 'Traditional dishes with local ingredients.',
    icon: 'fork-knife',
  },
  {
    title: 'Unforgettable views',
    description: 'A unique setting over the valley.',
    icon: 'image-alt',
  },
  {
    title: 'A warm atmosphere',
    description: 'Cozy and welcoming, all year round.',
    icon: 'house-heart',
  },
];

function HomePage() {
  const {
    user,
    isLoading,
    isSubmitting,
    errorMessage,
    feedbackMessage,
    handleLogin,
    handleLogout,
  } = useAuth();

  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const handleSignIn = () => setIsLoginOpen(true);

  const handleCloseLogin = () => {
    if (!isSubmitting) {
      setIsLoginOpen(false);
    }
  };

  /**
   * @param {LoginCredentials} credentials
   * @returns {Promise<boolean>}
   */
  const handleDialogLogin = async (credentials) => {
    const signedIn = await handleLogin(credentials);

    if (signedIn) {
      setIsLoginOpen(false);
    }

    return signedIn;
  };

  if (isLoading) {
    return (
      <div className="mh-page-loading" role="status">
        <Spinner animation="border" aria-hidden="true" />

        <span>Loading Mountain Hut…</span>
      </div>
    );
  }

  return (
    <div className="mh-app-shell mh-dine-page">
      <SiteHeader
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleLogout}
      />

      <main className="mh-reservation-main">
        <section
          className="mh-reserve-hero"
          aria-labelledby="reserve-title"
        >
          <img
            src="/images/reserve-hero.png"
            alt="Alpine mountain hut with panoramic views"
          />

          <div className="mh-hero-content">
            <span
              className="mh-section-rule"
              aria-hidden="true"
            />

            <p className="mh-hero-eyebrow">DINE</p>

            <h1 id="reserve-title">Reserve your table</h1>

            <p className="mh-hero-subtitle">
              A warm meal, a breathtaking view.
            </p>

            <p className="mh-hero-description">
              Enjoy traditional alpine cuisine in a unique setting.
              Let us take care of the details, you just enjoy the moment.
            </p>
          </div>
        </section>

        <section
          className="mh-reserve-content"
          id="reserve"
        >
          <BookingForm
            user={user}
            onRequireLogin={handleSignIn}
          />
        </section>

        <Row
          as="section"
          className="g-0 align-items-center mh-dining-experience"
          aria-labelledby="dining-experience-title"
        >
          <Col xs={12} className="mh-experience-intro">
            <span
              className="mh-section-rule"
              aria-hidden="true"
            />

            <p className="mh-experience-eyebrow">
              A UNIQUE DINING EXPERIENCE
            </p>

            <h2 id="dining-experience-title">
              More than a meal
            </h2>

            <p>
              Local ingredients, authentic flavours and a view
              that takes your breath away. A dining experience
              that makes your mountain day even more special.
            </p>
          </Col>

          <Col xs={12} className="mh-experience-features">
            <Row className="g-0 mh-experience-feature-row">
              {diningFeatures.map((feature) => (
                <Col
                  as="article"
                  xs={12}
                  md={4}
                  className="mh-experience-feature"
                  key={feature.title}
                >
                  <div className="mh-feature-icon d-flex align-items-center justify-content-center">
                    <i
                      className={`bi bi-${feature.icon}`}
                      aria-hidden="true"
                    />
                  </div>

                  <h3>{feature.title}</h3>

                  <p>{feature.description}</p>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      </main>

      <SiteFooter />

      {!user && isLoginOpen && (
        <LoginModal
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          feedbackMessage={feedbackMessage}
          onLogin={handleDialogLogin}
          onClose={handleCloseLogin}
        />
      )}
    </div>
  );
}

export default HomePage;