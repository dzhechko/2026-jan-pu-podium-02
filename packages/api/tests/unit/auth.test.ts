import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

const { AuthService, AuthError } = await import('../../src/modules/auth/service.js');

function createMockPrisma() {
  return {
    admin: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  } as any;
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InstanceType<typeof AuthService>;

  const JWT_SECRET = 'test-jwt-secret-that-is-long-enough';
  const JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-that-is-long-enough';

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AuthService(prisma, JWT_SECRET, JWT_REFRESH_SECRET);
  });

  describe('register', () => {
    it('creates admin and returns tokens', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);
      prisma.admin.create.mockResolvedValue({
        id: 'admin-1',
        email: 'test@example.com',
        companyName: 'TestCo',
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'securepass123',
        company_name: 'TestCo',
        phone: '+79001234567',
      });

      expect(result.token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.admin.email).toBe('test@example.com');
      expect(result.admin.company_name).toBe('TestCo');
    });

    it('throws on duplicate email', async () => {
      prisma.admin.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'dup@example.com',
          password: 'pass123',
          company_name: 'Co',
          phone: '+79001234567',
        }),
      ).rejects.toThrow('Email уже зарегистрирован');
    });

    it('throws AuthError with code DUPLICATE_EMAIL', async () => {
      prisma.admin.findUnique.mockResolvedValue({ id: 'existing' });

      try {
        await service.register({
          email: 'dup@example.com',
          password: 'pass123',
          company_name: 'Co',
          phone: '+79001234567',
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as InstanceType<typeof AuthError>).code).toBe('DUPLICATE_EMAIL');
        expect((err as InstanceType<typeof AuthError>).statusCode).toBe(409);
      }
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('correctpass', 4); // fast rounds for test
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'test@example.com',
        passwordHash: hash,
        companyName: 'TestCo',
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'correctpass',
      });

      expect(result.token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.admin.id).toBe('admin-1');
    });

    it('throws for unknown email', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow('Неверный email или пароль');
    });

    it('throws for wrong password', async () => {
      const hash = await bcrypt.hash('correctpass', 4);
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'test@example.com',
        passwordHash: hash,
        companyName: 'TestCo',
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpass' }),
      ).rejects.toThrow('Неверный email или пароль');
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies a valid token', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);
      prisma.admin.create.mockResolvedValue({
        id: 'admin-1',
        email: 'test@example.com',
        companyName: 'TestCo',
      });

      const { token } = await service.register({
        email: 'test@example.com',
        password: 'pass123',
        company_name: 'TestCo',
        phone: '+79001234567',
      });

      const payload = await service.verifyAccessToken(token);
      expect(payload.sub).toBe('admin-1');
      expect(payload.email).toBe('test@example.com');
    });

    it('rejects invalid token', async () => {
      await expect(
        service.verifyAccessToken('invalid.token.here'),
      ).rejects.toThrow();
    });
  });

  describe('refresh', () => {
    it('generates new tokens from valid refresh token', async () => {
      prisma.admin.findUnique.mockResolvedValueOnce(null); // register check
      prisma.admin.create.mockResolvedValue({
        id: 'admin-1',
        email: 'test@example.com',
        companyName: 'TestCo',
      });

      const { refresh_token } = await service.register({
        email: 'test@example.com',
        password: 'pass123',
        company_name: 'TestCo',
        phone: '+79001234567',
      });

      prisma.admin.findUnique.mockResolvedValue({ id: 'admin-1' });

      const result = await service.refresh(refresh_token);
      expect(result.token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('rejects invalid refresh token', async () => {
      await expect(service.refresh('bad-token')).rejects.toThrow();
    });
  });
});
