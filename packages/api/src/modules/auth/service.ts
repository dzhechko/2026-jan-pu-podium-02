import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';
import type { RegisterInput, LoginInput } from './schema.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

interface TokenPayload {
  sub: string;
  email: string;
}

export class AuthService {
  private accessSecret: Uint8Array;
  private refreshSecret: Uint8Array;

  constructor(private prisma: PrismaClient, jwtSecret: string, jwtRefreshSecret: string) {
    this.accessSecret = new TextEncoder().encode(jwtSecret);
    this.refreshSecret = new TextEncoder().encode(jwtRefreshSecret);
  }

  async register(input: RegisterInput) {
    const existing = await this.prisma.admin.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AuthError('DUPLICATE_EMAIL', 'Email уже зарегистрирован', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const admin = await this.prisma.admin.create({
      data: {
        email: input.email,
        passwordHash,
        companyName: input.company_name,
        phone: input.phone,
      },
    });

    const tokens = await this.generateTokens({ sub: admin.id, email: admin.email });

    return {
      ...tokens,
      admin: { id: admin.id, email: admin.email, company_name: admin.companyName },
    };
  }

  async login(input: LoginInput) {
    const admin = await this.prisma.admin.findUnique({ where: { email: input.email } });
    if (!admin) {
      throw new AuthError('AUTH_FAILED', 'Неверный email или пароль', 401);
    }

    const valid = await bcrypt.compare(input.password, admin.passwordHash);
    if (!valid) {
      throw new AuthError('AUTH_FAILED', 'Неверный email или пароль', 401);
    }

    const tokens = await this.generateTokens({ sub: admin.id, email: admin.email });

    return {
      ...tokens,
      admin: { id: admin.id, email: admin.email, company_name: admin.companyName },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const { payload } = await jwtVerify(refreshToken, this.refreshSecret);
      const sub = payload.sub as string;
      const email = payload.email as string;

      const admin = await this.prisma.admin.findUnique({ where: { id: sub } });
      if (!admin) {
        throw new AuthError('AUTH_FAILED', 'Пользователь не найден', 401);
      }

      return this.generateTokens({ sub, email });
    } catch {
      throw new AuthError('AUTH_FAILED', 'Невалидный refresh token', 401);
    }
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    const { payload } = await jwtVerify(token, this.accessSecret);
    return { sub: payload.sub as string, email: payload.email as string };
  }

  private async generateTokens(payload: TokenPayload) {
    const token = await new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(this.accessSecret);

    const refresh_token = await new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(this.refreshSecret);

    return { token, refresh_token };
  }
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
