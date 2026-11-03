import readline from "readline";
import argon2 from "argon2";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma, memoryStore, resilientDbWrite } from "../models/prisma";
import { logAudit } from "../services/auditLogger";

const emailSchema = z.string().email("Invalid email format");
const passwordSchema = z.string().min(12, "Password must be at least 12 characters long");

function askQuestion(query: string, hideInput = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hideInput && process.stdin.isTTY) {
      // Simple hidden mask in terminal
      process.stdout.write(query);
      const stdin = process.stdin;
      let input = "";
      const onData = (char: Buffer) => {
        const str = char.toString("utf-8");
        if (str === "\n" || str === "\r" || str === "\u0004") {
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (str === "\u0003") {
          process.exit(1);
        } else if (str === "\b" || str === "\x7f") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += str;
          process.stdout.write("*");
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
      });
    }
  });
}

export async function createAdminUser(customEmail?: string, customPassword?: string): Promise<{ id: string; email: string }> {
  let email = customEmail;
  let password = customPassword;

  // Check CLI arguments (--email, --password)
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      email = args[i + 1];
    }
    if (args[i] === "--password" && args[i + 1]) {
      password = args[i + 1];
    }
  }

  // Interactive prompts if not provided
  if (!email) {
    const rawEmail = await askQuestion("Enter Administrator Email: ");
    email = rawEmail.trim();
  }

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    console.error("❌ Validation Error:", parsedEmail.error.errors[0].message);
    process.exit(1);
  }

  if (!password) {
    const rawPass = await askQuestion("Enter Secure Password (min 12 characters): ", true);
    password = rawPass.trim();
  }

  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) {
    console.error("❌ Validation Error:", parsedPassword.error.errors[0].message);
    process.exit(1);
  }

  console.log("Generating secure argon2id cryptographic hash...");
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const userId = randomUUID();
  const now = new Date();

  await resilientDbWrite(
    async () => {
      await prisma.user.upsert({
        where: { email },
        update: {
          passwordHash,
          role: "admin",
          failedAttempts: 0,
          lockoutUntil: null,
          updatedAt: now,
        },
        create: {
          id: userId,
          email,
          passwordHash,
          role: "admin",
          failedAttempts: 0,
          lockoutUntil: null,
          createdAt: now,
          updatedAt: now,
        },
      });
    },
    () => {
      memoryStore.users.set(email, {
        id: userId,
        email,
        passwordHash,
        role: "admin",
        failedAttempts: 0,
        lockoutUntil: null,
        createdAt: now,
        updatedAt: now,
      });
    },
    "Create Admin User"
  );

  await logAudit({
    actor: email,
    action: "login",
    targetId: userId,
    details: { event: "admin_user_bootstrapped", email },
  });

  console.log(`✅ Administrator successfully registered: ${email} (Role: admin)`);
  return { id: userId, email };
}

// Run script if executed directly
if (require.main === module) {
  createAdminUser()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error creating admin user:", err);
      process.exit(1);
    });
}
