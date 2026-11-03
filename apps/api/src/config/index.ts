import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load root .env
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
// Also fallback to local apps/api/.env if present
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000").transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  AI_SERVICE_URL: z.string().default("http://localhost:8000"),
  AI_SERVICE_SHARED_SECRET: z.string().default("super_secret_internal_token_2026"),
  INTERNAL_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().default("postgresql://postgres:postgrespassword@localhost:5432/traffic_assistant?schema=public"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long").default("super_secret_traffic_assistant_jwt_2026_change_in_prod"),
  TRUST_PROXY: z.string().default("false").transform((val) => val === "true" || val === "1"),

  // Rate Limiting
  RATE_LIMIT_GLOBAL_MAX: z.string().default("100").transform((val) => parseInt(val, 10)),
  RATE_LIMIT_CHAT_MAX: z.string().default("20").transform((val) => parseInt(val, 10)),
  RATE_LIMIT_FINES_MAX: z.string().default("30").transform((val) => parseInt(val, 10)),
  RATE_LIMIT_WINDOW_MS: z.string().default("60000").transform((val) => parseInt(val, 10)),

  // AI Service Timeouts
  AI_TIMEOUT_CONNECT_MS: z.string().default("3000").transform((val) => parseInt(val, 10)),
  AI_TIMEOUT_FIRST_BYTE_MS: z.string().default("10000").transform((val) => parseInt(val, 10)),
  AI_TIMEOUT_TOTAL_MS: z.string().default("30000").transform((val) => parseInt(val, 10)),

  // File Upload & Retention & Malware Scanner Hooks
  UPLOAD_MAX_SIZE_MB: z.string().default("20").transform((val) => parseInt(val, 10)),
  QUERY_LOG_RETENTION_DAYS: z.string().default("90").transform((val) => parseInt(val, 10)),
  CLAMAV_HOST: z.string().optional(),

  // Argon2 Cost Settings (configurable via env, reduced in TEST environment only)
  ARGON2_MEMORY_COST: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  ARGON2_TIME_COST: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  ARGON2_PARALLELISM: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("FATAL: Environment variable validation failed:", parsed.error.format());
  process.exit(1);
}

const env = parsed.data;
const isJest = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === "test";

export const config = {
  port: env.PORT,
  nodeEnv: isJest ? ("test" as const) : env.NODE_ENV,
  clientUrl: env.CLIENT_URL,
  aiServiceUrl: env.AI_SERVICE_URL.replace(/\/+$/, ""),
  aiServiceSharedSecret: env.INTERNAL_API_KEY || env.AI_SERVICE_SHARED_SECRET,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  trustProxy: env.TRUST_PROXY,

  rateLimits: {
    globalMax: env.RATE_LIMIT_GLOBAL_MAX,
    chatMax: env.RATE_LIMIT_CHAT_MAX,
    finesMax: env.RATE_LIMIT_FINES_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  },

  timeouts: {
    connectMs: env.AI_TIMEOUT_CONNECT_MS,
    firstByteMs: env.AI_TIMEOUT_FIRST_BYTE_MS,
    totalMs: env.AI_TIMEOUT_TOTAL_MS,
  },

  upload: {
    maxSizeMb: env.UPLOAD_MAX_SIZE_MB,
    maxSizeBytes: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
  },

  retention: {
    queryLogDays: env.QUERY_LOG_RETENTION_DAYS,
  },

  clamav: {
    host: env.CLAMAV_HOST,
  },

  allowedJurisdictions: [
    "Central",
    "Delhi",
    "Maharashtra",
    "Karnataka",
    "Tamil Nadu",
    "Uttar Pradesh",
    "all",
  ] as const,

  allowedTopics: ["fines", "documents", "e-challan", "road-safety", "all"] as const,

  argon2: {
    // Production / Default full-strength OWASP recommendations: memory 65536 KB (64 MB), time 3, parallelism 4
    memoryCost: env.ARGON2_MEMORY_COST ?? (isJest ? 4096 : 65536),
    timeCost: env.ARGON2_TIME_COST ?? (isJest ? 1 : 3),
    parallelism: env.ARGON2_PARALLELISM ?? (isJest ? 1 : 4),
  },
};
