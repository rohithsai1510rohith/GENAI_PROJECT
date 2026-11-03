# ADR 001: Relational Persistence Layer (PostgreSQL + Prisma)

## Status
Accepted

## Context
The Traffic Rules & Fines Assistant requires persistence for:
1. Cached document metadata indexed by the Python AI microservice.
2. Anonymous chat sessions and sequential conversation messages.
3. Message citations, retrieval sources, and request latency for auditability.
4. User feedback (thumbs up / thumbs down and reasons) keyed per message and anonymous user identifier.
5. Search query logs and grounding metrics (`topScore`, `answered`).
6. Administrative user identity (schema provisioned for Phase 6 authentication).

The system must guarantee high reliability. If the PostgreSQL database is temporarily offline or connection pools are saturated:
- The API gateway must never fail client chat streams.
- Answers must still stream to the user in full.
- Errors must be recorded cleanly, and `/health` must report `degraded` rather than crashing.

## Decision
1. **Database Engine**: PostgreSQL 16.
2. **Object-Relational Mapping (ORM)**: Prisma ORM with strict TypeScript client bindings.
3. **Database Schema & Models**:
   - `User`: Admin accounts with bcrypt password hashes (Phase 6 scope).
   - `Document`: Synchronized cache of documents indexed in FAISS (`id`, `title`, `rawFilename`, `type`, `jurisdiction`, `effectiveDate`, `sourceUrl`, `status`, `chunkCount`, `isTestData`).
   - `ChatSession`: User or anonymous session container (`id`, `anonymousId`, `userId`, `createdAt`).
   - `Message`: Interaction history (`id`, `sessionId`, `role`, `content`, `sources` JSONB, `latencyMs`, `aborted`, `errored`, `createdAt`).
   - `Feedback`: Rating per message per anonymous ID (`id`, `messageId`, `anonymousId`, `rating`, `reason`, `createdAt`), with composite unique constraint `@@unique([messageId, anonymousId])`.
   - `QueryLog`: High-level grounding logs (`id`, `question`, `topScore`, `answered`, `createdAt`).
4. **Resilience Strategy**:
   - Database operations in asynchronous post-stream lifecycle hooks are executed non-blockingly.
   - If Prisma throws a connection error, an in-memory cache/store buffers recent logs and feedback so queries can still succeed.
   - Database health check in `GET /api/v1/health` executes a lightweight ping (`SELECT 1`). If the connection fails, the API status switches to `degraded`.

## Consequences
- **Positive**: Type-safe relational schema with foreign key cascades; reproducible schema state via SQL migrations; resilient degradation during container/service outages.
- **Negative**: Requires managing Docker/PostgreSQL containers in local and production environments.
