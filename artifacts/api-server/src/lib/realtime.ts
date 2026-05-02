import type { Server as HttpServer } from "node:http";
import { and, eq, or } from "drizzle-orm";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { db, conversationsTable } from "@workspace/db";
import { verifyToken } from "./auth";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

export function initRealtime(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: true, credentials: true },
    serveClient: false,
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth && (socket.handshake.auth as { token?: string }).token) ||
      (typeof socket.handshake.query["token"] === "string"
        ? (socket.handshake.query["token"] as string)
        : undefined);
    if (!token) {
      return next(new Error("auth_required"));
    }
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error("invalid_token"));
    }
    (socket.data as { userId?: number }).userId = payload.uid;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const uid = (socket.data as { userId?: number }).userId;
    if (typeof uid === "number") {
      socket.join(`user:${uid}`);
      logger.debug({ uid, sid: socket.id }, "socket connected");
    }
    socket.on("conversation:join", async (raw: unknown) => {
      const cid = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(cid) || typeof uid !== "number") return;
      // Only allow joining a conversation room if this socket's user is a party.
      const [c] = await db
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.id, cid),
            or(
              eq(conversationsTable.clientId, uid),
              eq(conversationsTable.freelancerId, uid),
            ),
          ),
        );
      if (c) {
        socket.join(`conversation:${cid}`);
      } else {
        logger.warn({ uid, cid, sid: socket.id }, "socket conversation:join denied");
      }
    });
    socket.on("conversation:leave", (raw: unknown) => {
      const cid = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(cid)) socket.leave(`conversation:${cid}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: number, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToConversation(
  conversationId: number,
  event: string,
  payload: unknown,
): void {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
}

export async function shutdownRealtime(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => {
    io!.close(() => resolve());
  });
  io = null;
}
