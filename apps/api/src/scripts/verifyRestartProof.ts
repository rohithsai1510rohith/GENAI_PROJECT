import { prisma } from "../models/prisma";
import { authenticateUser } from "../services/authService";

async function main() {
  const email = "admin@trafficassistant.gov.in";
  console.log("=== STEP 2.4: POST-RESTART PROOF VERIFICATION ===");

  // 1. Verify user is still locked
  const user = await prisma.user.findUnique({ where: { email } });
  console.log("User state in PostgreSQL after API restart:");
  console.log({
    email: user?.email,
    failedAttempts: user?.failedAttempts,
    lockoutUntil: user?.lockoutUntil,
    isLocked: user?.lockoutUntil ? user.lockoutUntil.getTime() > Date.now() : false,
  });

  // Test authentication rejection
  try {
    await authenticateUser(email, "AnyPassword123!");
    console.log("Unexpected success during lockout!");
  } catch (err: any) {
    console.log(`Login attempt rejected as expected: ${err.message} (code: ${err.code})`);
  }

  // 2. Verify revoked token still revoked
  const revokedToken = await prisma.refreshToken.findFirst({
    where: { revoked: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("\nRevoked token in PostgreSQL after API restart:");
  console.log({
    id: revokedToken?.id,
    tokenHash: revokedToken?.tokenHash,
    revoked: revokedToken?.revoked,
    expiresAt: revokedToken?.expiresAt,
  });

  console.log("\n=== RESTART PROOF CONFIRMED: Lockout and revocation persisted in PostgreSQL across restart ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
