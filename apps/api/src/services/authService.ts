import jwt from "jsonwebtoken";
import argon2 from "argon2";
import crypto from "crypto";
import { config } from "../config";
import { prisma, memoryStore, resilientDbWrite, InMemoryUser, InMemoryRefreshToken } from "../models/prisma";
import { logAudit } from "./auditLogger";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(user: TokenPayload): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, jti: crypto.randomUUID() },
    config.jwtSecret,
    { expiresIn: "15m" } // Strict 15-minute lifetime
  );
}

export function generateRefreshTokenString(): string {
  return crypto.randomBytes(48).toString("hex");
}

export const REFRESH_TOKEN_COOKIE_NAME = "traffic_refresh_token";

export function getCookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict" as const,
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

export function getClearCookieOptions() {
  const { maxAge: _unused, ...opts } = getCookieOptions();
  return opts;
}

/**
 * Validates login credentials with account lockout protections and generic error responses.
 */
export async function authenticateUser(
  email: string,
  pass: string,
  requestId?: string
): Promise<{ accessToken: string; rawRefreshToken: string; user: TokenPayload }> {
  const genericError = new Error("Invalid email or password");
  (genericError as any).statusCode = 401;
  (genericError as any).code = "INVALID_CREDENTIALS";

  const normalizedEmail = (email || "").toLowerCase().trim();

  // 1. Fetch user from DB or memory fallback
  let user: InMemoryUser | any = null;
  try {
    user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      user = memoryStore.users.get(normalizedEmail);
    }
  } catch {
    user = memoryStore.users.get(normalizedEmail);
  }

  // Prevent timing attack if user does not exist
  if (!user) {
    await argon2.hash("dummy_timing_mitigation_pass_12345", {
      type: argon2.argon2id,
      ...config.argon2,
    });
    await logAudit({
      actor: email,
      action: "login_failed",
      details: { reason: "user_not_found" },
      requestId,
    });
    throw genericError;
  }

  // 2. Check 15-minute account lockout after 5 failures
  if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
    const remainingMs = new Date(user.lockoutUntil).getTime() - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    await logAudit({
      actor: email,
      action: "lockout",
      targetId: user.id,
      details: { remainingMins },
      requestId,
    });
    const lockoutErr = new Error(`Account temporarily locked due to excessive failed attempts. Try again in ${remainingMins} minute(s).`);
    (lockoutErr as any).statusCode = 429; // Account Locked / Too Many Requests
    (lockoutErr as any).code = "ACCOUNT_LOCKED";
    throw lockoutErr;
  }

  // 3. Verify Argon2id hash
  let isValid = false;
  try {
    isValid = await argon2.verify(user.passwordHash, pass);
  } catch {
    isValid = false;
  }

  if (!isValid) {
    const newFailed = (user.failedAttempts || 0) + 1;
    let lockoutUntil: Date | null = null;
    if (newFailed >= 5) {
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
    }

    await resilientDbWrite(
      async () => {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: newFailed, lockoutUntil },
        });
      },
      () => {
        user.failedAttempts = newFailed;
        user.lockoutUntil = lockoutUntil;
        memoryStore.users.set(email, user);
      },
      "Update failed attempts"
    );

    await logAudit({
      actor: email,
      action: newFailed >= 5 ? "lockout" : "login_failed",
      targetId: user.id,
      details: { failedAttempts: newFailed, locked: newFailed >= 5 },
      requestId,
    });

    if (newFailed >= 5) {
      const err = new Error("Account temporarily locked due to excessive failed attempts. Try again in 15 minutes.");
      (err as any).statusCode = 429;
      (err as any).code = "ACCOUNT_LOCKED";
      throw err;
    }

    throw genericError;
  }

  // 4. Reset failed attempts on success
  await resilientDbWrite(
    async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockoutUntil: null },
      });
    },
    () => {
      user.failedAttempts = 0;
      user.lockoutUntil = null;
      memoryStore.users.set(email, user);
    },
    "Reset failed attempts"
  );

  // 5. Generate 15-minute Access JWT & 7-day Rotating Refresh Token
  const tokenUser: TokenPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenUser);
  const rawRefreshToken = generateRefreshTokenString();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const refreshTokenId = crypto.randomUUID();
  const tokenRecord: InMemoryRefreshToken = {
    id: refreshTokenId,
    tokenHash,
    userId: user.id,
    revoked: false,
    expiresAt,
    createdAt: new Date(),
  };

  await resilientDbWrite(
    async () => {
      await prisma.refreshToken.create({
        data: {
          id: refreshTokenId,
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });
    },
    () => {
      memoryStore.refreshTokens.set(tokenHash, tokenRecord);
    },
    "Create refresh token"
  );

  await logAudit({
    actor: user.email,
    action: "login",
    targetId: user.id,
    requestId,
  });

  return { accessToken, rawRefreshToken, user: tokenUser };
}

/**
 * Rotates an existing refresh token: revokes the old token and issues a fresh pair.
 * If a revoked token is used, revokes all tokens for that user (token reuse detection).
 */
export async function rotateRefreshToken(
  rawToken: string,
  requestId?: string
): Promise<{ accessToken: string; rawRefreshToken: string; user: TokenPayload }> {
  const tokenHash = hashToken(rawToken);

  let record: any = null;
  try {
    record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) {
      record = memoryStore.refreshTokens.get(tokenHash);
      if (record && !record.user) {
        for (const u of memoryStore.users.values()) {
          if (u.id === record.userId) {
            record.user = u;
            break;
          }
        }
      }
    }
  } catch {
    record = memoryStore.refreshTokens.get(tokenHash);
    if (record && !record.user) {
      for (const u of memoryStore.users.values()) {
        if (u.id === record.userId) {
          record.user = u;
          break;
        }
      }
    }
  }

  if (!record) {
    const err = new Error("Invalid refresh token");
    (err as any).statusCode = 401;
    (err as any).code = "UNAUTHORIZED";
    throw err;
  }

  // Token reuse attack detection
  if (record.revoked) {
    // Revoke all tokens for this user
    await resilientDbWrite(
      async () => {
        await prisma.refreshToken.updateMany({
          where: { userId: record.userId },
          data: { revoked: true },
        });
      },
      () => {
        for (const t of memoryStore.refreshTokens.values()) {
          if (t.userId === record.userId) t.revoked = true;
        }
      },
      "Revoke all tokens on reuse detection"
    );

    await logAudit({
      actor: record.user?.email || record.userId,
      action: "refresh_token",
      targetId: record.userId,
      details: { alert: "token_reuse_detected" },
      requestId,
    });

    const err = new Error("Refresh token has been revoked. Session terminated.");
    (err as any).statusCode = 401;
    (err as any).code = "TOKEN_REUSED";
    throw err;
  }

  if (new Date(record.expiresAt) < new Date()) {
    const err = new Error("Refresh token expired");
    (err as any).statusCode = 401;
    (err as any).code = "TOKEN_EXPIRED";
    throw err;
  }

  // Revoke the old token
  await resilientDbWrite(
    async () => {
      await prisma.refreshToken.update({
        where: { id: record.id },
        data: { revoked: true },
      });
    },
    () => {
      record.revoked = true;
      memoryStore.refreshTokens.set(tokenHash, record);
    },
    "Revoke old refresh token"
  );

  // Issue new access and refresh token pair
  const user = record.user;
  const tokenUser: TokenPayload = { id: user.id, email: user.email, role: user.role };
  const newAccessToken = generateAccessToken(tokenUser);
  const newRawRefreshToken = generateRefreshTokenString();
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const newId = crypto.randomUUID();
  const newRecord: InMemoryRefreshToken = {
    id: newId,
    tokenHash: newTokenHash,
    userId: user.id,
    revoked: false,
    expiresAt: newExpiresAt,
    createdAt: new Date(),
  };

  await resilientDbWrite(
    async () => {
      await prisma.refreshToken.create({
        data: {
          id: newId,
          tokenHash: newTokenHash,
          userId: user.id,
          expiresAt: newExpiresAt,
        },
      });
    },
    () => {
      memoryStore.refreshTokens.set(newTokenHash, newRecord);
    },
    "Issue new rotated refresh token"
  );

  await logAudit({
    actor: user.email,
    action: "refresh_token",
    targetId: user.id,
    requestId,
  });

  return { accessToken: newAccessToken, rawRefreshToken: newRawRefreshToken, user: tokenUser };
}

/**
 * Revokes an existing refresh token on logout.
 */
export async function revokeRefreshToken(rawToken: string, requestId?: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);

  let userId: string | null = null;
  await resilientDbWrite(
    async () => {
      const rec = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (rec) {
        userId = rec.userId;
        await prisma.refreshToken.update({
          where: { tokenHash },
          data: { revoked: true },
        });
      }
    },
    () => {
      const rec = memoryStore.refreshTokens.get(tokenHash);
      if (rec) {
        rec.revoked = true;
        userId = rec.userId;
      }
    },
    "Revoke refresh token on logout"
  );

  await logAudit({
    actor: userId || "anonymous",
    action: "logout",
    targetId: userId,
    requestId,
  });
}

/**
 * Creates a new administrative user with Argon2id password hash.
 */
export async function registerUser(
  email: string,
  pass: string,
  role = "admin"
): Promise<{ id: string; email: string; role: string }> {
  const passwordHash = await argon2.hash(pass, {
    type: argon2.argon2id,
    memoryCost: config.argon2.memoryCost,
    timeCost: config.argon2.timeCost,
    parallelism: config.argon2.parallelism,
  });

  const userId = crypto.randomUUID();
  const userData = {
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    failedAttempts: 0,
    lockoutUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await resilientDbWrite(
    async () => {
      await prisma.user.create({
        data: {
          id: userId,
          email: userData.email,
          passwordHash,
          role,
        },
      });
    },
    () => {
      memoryStore.users.set(userData.email, userData);
    },
    `Register user ${email}`
  );

  return { id: userId, email: userData.email, role };
}
