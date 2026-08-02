import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getCreatorDashboard: vi.fn(),
  rotateCreatorStreamKey: vi.fn(),
  updateCreatorNotifications: vi.fn(),
  updateCreatorProfile: vi.fn(),
  updateCreatorStream: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

function createContext(authenticated = true): TrpcContext {
  return {
    user: authenticated ? {
      id: 42,
      openId: "creator-42",
      email: "creator@example.com",
      name: "Kryv Creator",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("creator router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose a creator dashboard to unauthenticated callers", async () => {
    const caller = appRouter.createCaller(createContext(false));
    await expect(caller.creator.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.getCreatorDashboard).not.toHaveBeenCalled();
  });

  it("scopes dashboard retrieval to the authenticated creator", async () => {
    const response = { profile: { displayName: "Kryv Creator" }, stream: {}, stats: {} };
    dbMocks.getCreatorDashboard.mockResolvedValue(response);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.creator.dashboard()).resolves.toEqual(response);
    expect(dbMocks.getCreatorDashboard).toHaveBeenCalledWith(42, "Kryv Creator");
  });

  it("rejects an invalid creator profile before it reaches persistence", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.creator.profile.update({
      displayName: "A",
      bio: "",
      avatarUrl: "",
      brandColor: "not-a-color",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.updateCreatorProfile).not.toHaveBeenCalled();
  });

  it("returns a newly generated stream key only to the authenticated creator", async () => {
    const rotated = {
      streamKey: "kryv_live_new-secret-key",
      streamKeyPreview: "••••key",
      lastKeyRotatedAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    dbMocks.rotateCreatorStreamKey.mockResolvedValue(rotated);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.creator.stream.rotateKey()).resolves.toEqual(rotated);
    expect(dbMocks.rotateCreatorStreamKey).toHaveBeenCalledWith(42, "Kryv Creator");
  });
});
