import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { closeSharedState, getRealtimeSubscriber, realtimeRoom, type KryvRealtimeEvent } from "./lib/realtime";
import { verifyRealtimeToken } from "./lib/auth";
import { logger } from "./lib/logger";

const PORT = Number(process.env.PORT ?? 10000);
const MAX_ROOMS_PER_CLIENT = 50;
const HEARTBEAT_MS = 30_000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

function acceptsOrigin(origin: string | undefined) {
  if (!origin) return true;
  return process.env.NODE_ENV !== "production" || allowedOrigins.includes(origin);
}

function readOptionalAuthToken(header: string | string[] | undefined) {
  const protocols = (Array.isArray(header) ? header.join(",") : header ?? "")
    .split(",")
    .map((value) => value.trim());
  const tokenProtocol = protocols.find((value) => value.startsWith("access."));
  return tokenProtocol ? tokenProtocol.slice("access.".length) : null;
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "kryv-realtime" }));
    return;
  }
  res.writeHead(404).end();
});

const gateway = new WebSocketServer({
  noServer: true,
  clientTracking: false,
  handleProtocols: (protocols) => protocols.has("kryv.v1") ? "kryv.v1" : false,
});

const channelSockets = new Map<number, Set<WebSocket>>();
const socketChannels = new WeakMap<WebSocket, Set<number>>();
const heartbeat = new WeakMap<WebSocket, boolean>();
const redisSubscriber = getRealtimeSubscriber();

async function subscribeSocketToChannel(socket: WebSocket, channelId: number) {
  const rooms = socketChannels.get(socket) ?? new Set<number>();
  if (rooms.size >= MAX_ROOMS_PER_CLIENT && !rooms.has(channelId)) {
    send(socket, { type: "error", code: "room_limit", message: "Too many realtime channel subscriptions." });
    return;
  }
  if (rooms.has(channelId)) return;

  let listeners = channelSockets.get(channelId);
  if (!listeners) {
    listeners = new Set<WebSocket>();
    channelSockets.set(channelId, listeners);
    if (redisSubscriber) await redisSubscriber.subscribe(realtimeRoom(channelId));
  }
  listeners.add(socket);
  rooms.add(channelId);
  socketChannels.set(socket, rooms);
  send(socket, { type: "subscribed", channelId });
}

async function unsubscribeSocketFromChannel(socket: WebSocket, channelId: number) {
  const rooms = socketChannels.get(socket);
  if (!rooms?.delete(channelId)) return;
  const listeners = channelSockets.get(channelId);
  listeners?.delete(socket);
  if (listeners && listeners.size === 0) {
    channelSockets.delete(channelId);
    if (redisSubscriber) await redisSubscriber.unsubscribe(realtimeRoom(channelId));
  }
  send(socket, { type: "unsubscribed", channelId });
}

async function releaseSocket(socket: WebSocket) {
  const rooms = [...(socketChannels.get(socket) ?? [])];
  await Promise.all(rooms.map((channelId) => unsubscribeSocketFromChannel(socket, channelId)));
}

if (redisSubscriber) {
  redisSubscriber.on("message", (room, rawPayload) => {
    if (!room.startsWith("kryv:room:")) return;
    const channelId = Number(room.slice("kryv:room:".length));
    if (!Number.isSafeInteger(channelId)) return;
    let event: KryvRealtimeEvent;
    try {
      event = JSON.parse(rawPayload) as KryvRealtimeEvent;
    } catch {
      logger.warn({ room }, "Ignored malformed shared realtime event");
      return;
    }
    for (const socket of channelSockets.get(channelId) ?? []) send(socket, event);
  });
} else {
  logger.warn("KRYV_CACHE_REDIS_URL is not configured; the realtime gateway will remain healthy but will not fan out events until shared state is provisioned.");
}

server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin;
  if (request.url !== "/ws" || !acceptsOrigin(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  const token = readOptionalAuthToken(request.headers["sec-websocket-protocol"]);
  const auth = token ? verifyRealtimeToken(token) : null;
  gateway.handleUpgrade(request, socket, head, (client) => {
    (client as WebSocket & { kryvUserId?: number }).kryvUserId = auth?.userId;
    gateway.emit("connection", client, request);
  });
});

gateway.on("connection", (socket) => {
  heartbeat.set(socket, true);
  send(socket, { type: "ready", protocol: "kryv.v1", authenticated: Boolean((socket as WebSocket & { kryvUserId?: number }).kryvUserId) });

  socket.on("pong", () => heartbeat.set(socket, true));
  socket.on("message", async (raw) => {
    let input: { type?: string; channelId?: unknown };
    try {
      input = JSON.parse(raw.toString()) as { type?: string; channelId?: unknown };
    } catch {
      send(socket, { type: "error", code: "invalid_message" });
      return;
    }
    const channelId = typeof input.channelId === "number" && Number.isInteger(input.channelId) && input.channelId > 0
      ? input.channelId
      : null;
    if (!channelId || !["subscribe", "unsubscribe"].includes(input.type ?? "")) {
      send(socket, { type: "error", code: "invalid_subscription" });
      return;
    }
    try {
      if (input.type === "subscribe") await subscribeSocketToChannel(socket, channelId);
      else await unsubscribeSocketFromChannel(socket, channelId);
    } catch (error) {
      logger.warn({ error, channelId }, "Realtime room operation failed");
      send(socket, { type: "error", code: "subscription_unavailable" });
    }
  });
  socket.on("close", () => { releaseSocket(socket).catch((error) => logger.warn({ error }, "Realtime client cleanup failed")); });
  socket.on("error", (error) => logger.warn({ error }, "Realtime client socket error"));
});

const heartbeatTimer = setInterval(() => {
  for (const listeners of channelSockets.values()) {
    for (const socket of listeners) {
      if (!heartbeat.get(socket)) {
        socket.terminate();
        continue;
      }
      heartbeat.set(socket, false);
      socket.ping();
    }
  }
}, HEARTBEAT_MS);

async function shutdown(signal: string) {
  logger.info({ signal }, "Stopping Kryv realtime gateway");
  clearInterval(heartbeatTimer);
  gateway.close();
  server.close();
  await closeSharedState();
  process.exit(0);
}

process.once("SIGTERM", () => { shutdown("SIGTERM").catch(() => process.exit(1)); });
process.once("SIGINT", () => { shutdown("SIGINT").catch(() => process.exit(1)); });

server.listen(PORT, () => logger.info({ port: PORT }, "Kryv realtime gateway listening"));
