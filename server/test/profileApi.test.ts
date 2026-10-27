import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 6]);

test("a native app reads and changes its own profile name and photo with a token", async () => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
  const { db, runMigrations } = await import("../src/db/index.js");
  const { v1Router } = await import("../src/api/v1/index.js");
  const { createPersonalAccessToken } = await import("../src/auth/tokens.js");
  const { findUserById } = await import("../src/auth/users.js");
  runMigrations();

  const addUser = db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'hash', ?)");
  const ownerId = Number(addUser.run("profile-owner@example.test", "Owner").lastInsertRowid);
  const otherId = Number(addUser.run("profile-other@example.test", "Other").lastInsertRowid);
  const writer = createPersonalAccessToken(ownerId, "iPhone", "write", { platform: "ios", appVersion: "1.0.0" }).token;
  const reader = createPersonalAccessToken(ownerId, "Reader", "read").token;
  const stranger = createPersonalAccessToken(otherId, "Other phone", "write", { platform: "ios", appVersion: null }).token;

  const app = express();
  app.use(express.json());
  app.use("/api/v1", v1Router);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const call = async (path: string, token: string | null, init: { method?: string; json?: unknown; image?: { type: string; data: Buffer } } = {}) => {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (init.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.json);
    } else if (init.image) {
      headers["content-type"] = init.image.type;
      body = new Uint8Array(init.image.data);
    }
    const response = await fetch(base + path, { method: init.method ?? "GET", headers, body });
    const type = response.headers.get("content-type") ?? "";
    const raw = Buffer.from(await response.arrayBuffer());
    return { status: response.status, type, cache: response.headers.get("cache-control"), raw, body: type.includes("json") ? JSON.parse(raw.toString("utf8")) : null };
  };

  try {
    // Announced in /meta, so an app can hide the editor on a server that cannot save a profile.
    assert.ok((await call("/meta", null)).body.features.includes("account-profile"));

    // Without a photo the version is null; the profile needs a token.
    const before = await call("/me", writer);
    assert.equal(before.status, 200);
    assert.equal(before.body.displayName, "Owner");
    assert.equal(before.body.avatarUpdatedAt, null);
    assert.equal((await call("/me", null)).status, 401);
    assert.equal((await call("/me/avatar", writer)).status, 404);

    // The name is trimmed and validated; the answer is the profile as /me shows it.
    const renamed = await call("/me", writer, { method: "PATCH", json: { displayName: "  Renamed Owner  " } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.displayName, "Renamed Owner");
    assert.equal(renamed.body.scope, "write");
    assert.equal(findUserById(ownerId)?.display_name, "Renamed Owner");
    assert.equal(findUserById(otherId)?.display_name, "Other", "another account keeps its name");
    for (const displayName of ["", "   ", "x".repeat(101), 7]) {
      assert.equal((await call("/me", writer, { method: "PATCH", json: { displayName } })).status, 400, `rejects ${JSON.stringify(displayName)}`);
    }
    assert.equal(findUserById(ownerId)?.display_name, "Renamed Owner");

    // A photo is stored by its signature, and the response carries the new version.
    const uploaded = await call("/me/avatar", writer, { method: "PUT", image: { type: "image/jpeg", data: JPEG } });
    assert.equal(uploaded.status, 200);
    assert.ok(uploaded.body.avatarUpdatedAt);
    const photo = await call("/me/avatar", writer);
    assert.equal(photo.status, 200);
    assert.equal(photo.type, "image/jpeg");
    assert.deepEqual(photo.raw, JPEG);
    assert.match(photo.cache ?? "", /immutable/);
    assert.equal((await call("/me", writer)).body.avatarUpdatedAt, uploaded.body.avatarUpdatedAt);
    assert.equal((await call("/me/avatar", stranger)).status, 404, "a photo belongs to its account");

    // A declared image type is not trusted: the bytes have to be a JPEG, PNG or WebP.
    const fake = await call("/me/avatar", writer, { method: "PUT", image: { type: "image/png", data: Buffer.from("<svg onload=alert(1)>") } });
    assert.equal(fake.status, 400);
    assert.equal(fake.body.error, "invalid_image");
    assert.equal((await call("/me/avatar", writer, { method: "PUT", image: { type: "image/svg+xml", data: JPEG } })).status, 400);
    assert.deepEqual((await call("/me/avatar", writer)).raw, JPEG, "a refused upload leaves the photo as it was");

    // Replacing the photo replaces it, it does not add a second one.
    const replaced = await call("/me/avatar", writer, { method: "PUT", image: { type: "image/png", data: PNG } });
    assert.equal(replaced.status, 200);
    assert.equal((await call("/me/avatar", writer)).type, "image/png");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM user_avatars WHERE user_id = ?").get(ownerId)?.count, 1);

    // The size limit of the web app applies.
    const large = await call("/me/avatar", writer, { method: "PUT", image: { type: "image/jpeg", data: Buffer.concat([JPEG, Buffer.alloc(512 * 1024)]) } });
    assert.equal(large.status, 413);
    assert.equal((await call("/me/avatar", writer)).type, "image/png");

    // A read-only token may look at the profile and the photo, but change nothing.
    assert.equal((await call("/me", reader)).body.scope, "read");
    assert.equal((await call("/me/avatar", reader)).status, 200);
    for (const attempt of [
      call("/me", reader, { method: "PATCH", json: { displayName: "Nope" } }),
      call("/me/avatar", reader, { method: "PUT", image: { type: "image/jpeg", data: JPEG } }),
      call("/me/avatar", reader, { method: "DELETE" }),
    ]) {
      const result = await attempt;
      assert.equal(result.status, 403);
      assert.equal(result.body.error, "read_only_token");
    }
    assert.equal(findUserById(ownerId)?.display_name, "Renamed Owner");

    // Deleting removes only this account's photo and returns the profile without a version.
    assert.equal((await call("/me/avatar", stranger, { method: "PUT", image: { type: "image/jpeg", data: JPEG } })).status, 200);
    const removed = await call("/me/avatar", writer, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.avatarUpdatedAt, null);
    assert.equal((await call("/me/avatar", writer)).status, 404);
    assert.equal((await call("/me/avatar", stranger)).status, 200);
  } finally {
    server.close();
  }
});
