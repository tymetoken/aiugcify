/**
 * Vitest Test Setup
 * Sets up mocks and test utilities
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
        retrieve: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
      },
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: 'cs_test_session123',
            url: 'https://checkout.stripe.com/test',
            payment_status: 'unpaid',
          }),
          retrieve: vi.fn().mockResolvedValue({
            id: 'cs_test_session123',
            payment_status: 'paid',
            metadata: {
              userId: 'user123',
              credits: '10',
              bonusCredits: '0',
            },
            payment_intent: 'pi_test123',
          }),
        },
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'sub_test123',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          items: {
            data: [{ id: 'si_test123', price: { id: 'price_test123' } }],
          },
        }),
        update: vi.fn().mockResolvedValue({
          id: 'sub_test123',
          status: 'active',
        }),
      },
      prices: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'price_test123',
          unit_amount: 1900,
          active: true,
        }),
      },
      webhooks: {
        constructEvent: vi.fn().mockImplementation((payload, sig, secret) => {
          const parsed = JSON.parse(payload.toString());
          return {
            id: 'evt_test123',
            type: parsed.type || 'checkout.session.completed',
            data: { object: parsed.data?.object || {} },
          };
        }),
      },
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            url: 'https://billing.stripe.com/test',
          }),
        },
      },
      invoices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      charges: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
    })),
  };
});

// Mock Redis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      call: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    })),
  };
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});
