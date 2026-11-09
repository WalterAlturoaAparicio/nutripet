// Environment for integration tests (loaded before each test file).
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef0123';
process.env.SETUP_TOKEN = 'test-setup-token-0123456789abcdef0123456';
process.env.COOKIE_SECURE = 'false';
(process.env as Record<string, string>).NODE_ENV = 'test';
