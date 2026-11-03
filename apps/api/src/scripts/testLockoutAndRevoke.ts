import { prisma } from "../models/prisma";
import { authenticateUser } from "../services/authService";

async function main() {
  const email = "admin@trafficassistant.gov.in";
  console.log("=== STEP 2.4: RESTART PROOF ===");

  // 1. Trigger 5 failed login attempts to lock the account
  console.log("Attempting 5 failed logins for:", email);
  for (let i = 1; i <= 5; i++) {
    try {
      await authenticateUser(email, "WrongPassword!" + i);
      console.log(`Attempt ${i}: Unexpected success`);
    } catch (err: any) {
      console.log(`Attempt ${i}: ${err.message} (code: ${err.code})`);
    }
  }

  // Check user state in DB
  let user = await prisma.user.findUnique({ where: { email } });
  console.log("\nUser state in PostgreSQL:");
  console.log({
    email: user?.email,
    failedAttempts: user?.failedAttempts,
    lockoutUntil: user?.lockoutUntil,
    isLocked: user?.lockoutUntil && user.lockoutUntil.getTime() > Date.now(),
  });

  // 2. Create and revoke a refresh token
  if (!user) throw new Error("User not found");
  const testTokenHash = "test_revoke_hash_" + Date.now();
  const tokenRecord = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: testTokenHash,
      revoked: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  console.log("\nCreated and revoked refresh token in PostgreSQL:");
  console.log({
    id: tokenRecord.id,
    tokenHash: tokenRecord.tokenHash,
    revoked: tokenRecord.revoked,
    expiresAt: tokenRecord.expiresAt,
  });

  console.log("\nReady for API restart verification.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
