// tests/routes/healthRoutes.test.ts
import request from 'supertest';
import app from '@src/app'; // Path alias
import http from 'http';

describe('Health Route (/health)', () => {
  let appServer: http.Server;

  beforeAll(async () => {
    // Start the main app on a dynamic port
    await new Promise<void>(resolve => {
        appServer = app.listen(0, () => resolve());
    });
    process.env.PORT = (appServer.address() as import('net').AddressInfo).port.toString();
  });

  afterAll(async () => {
    if (appServer) await new Promise<void>(resolve => appServer.close(() => resolve()));
  });

  it('should return 200 OK with health status', async () => {
    const response = await request(appServer) // Use appServer directly with supertest
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.message).toBe('OK');
    expect(response.body.uptime).toBeGreaterThan(0);
    expect(response.body.timestamp).toBeCloseTo(Date.now(), -3); // Allow a few ms difference
  });
});
