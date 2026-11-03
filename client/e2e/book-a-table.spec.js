import { test, expect } from '@playwright/test';

// Browser journey with isolated API responses; backend integration is tested separately.
test('hiker signs in, checks capacity and sees booking confirmation', async ({ page }) => {
  let bookingSubmitted = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();
    const respond = (status, body) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (pathname === '/api/sessions/current' && method === 'GET') {
      return respond(401, { error: { message: 'Unauthenticated' } });
    }
    if (pathname === '/api/sessions' && method === 'POST') {
      expect(request.postDataJSON()).toEqual({
        email: 'hiker@example.com',
        password: 'TestPassword123!',
      });
      return respond(201, {
        user: { id: 15, full_name: 'Test Hiker', email: 'hiker@example.com', role: 'hiker' },
      });
    }
    if (pathname === '/api/meal-slots' && method === 'GET') {
      return respond(200, {
        mealSlots: [{ id: 3, name: 'Dinner', startTime: '18:00', endTime: '20:00', isActive: true }],
      });
    }
    if (pathname === '/api/bookings/availability' && method === 'GET') {
      expect(url.searchParams.get('bookingDate')).toBe('2099-12-31');
      expect(url.searchParams.get('slotId')).toBe('3');
      return respond(200, {
        availability: {
          bookingDate: '2099-12-31', slotId: 3, slotName: 'Dinner',
          startTime: '18:00', endTime: '20:00', totalAvailableSeats: 4,
          tables: [{ id: 7, name: 'Table 1', seatCount: 4, reservedSeats: 0, availableSeats: 4 }],
        },
      });
    }
    if (pathname === '/api/bookings' && method === 'POST') {
      expect(request.postDataJSON()).toEqual({
        bookingDate: '2099-12-31', slotId: 3, partySize: 2,
      });
      bookingSubmitted = true;
      return respond(201, {
        booking: { id: 123, bookingDate: '2099-12-31', slotId: 3, partySize: 2, status: 'confirmed' },
      });
    }
    throw new Error(`Unexpected API request: ${method} ${pathname}`);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Reserve your table' })).toBeVisible();
  await page.getByLabel('Date', { exact: true }).fill('2099-12-31');
  await page.getByLabel('Meal service').selectOption('3');
  await page.getByLabel('Guests').selectOption('2');
  await page.getByRole('button', { name: /Check availability/i }).click();
  await expect(page.getByRole('heading', { name: 'A table is available' })).toBeVisible();
  await page.getByRole('button', { name: /Sign in to continue/i }).click();
  const login = page.getByRole('dialog', { name: 'Sign in to Mountain Hut' });
  await login.getByLabel('Email address').fill('hiker@example.com');
  await login.getByLabel('Password').fill('TestPassword123!');
  await login.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(login).not.toBeVisible();
  await page.getByRole('button', { name: /Confirm reservation/i }).click();
  await expect(page.getByRole('heading', { name: "You're all booked!" })).toBeVisible();
  await expect(page.getByText('#123')).toBeVisible();
  expect(bookingSubmitted).toBe(true);
});