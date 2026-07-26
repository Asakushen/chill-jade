import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "./auth";

describe("password authentication", () => {
  it("hashes and verifies a password without storing plaintext", async () => {
    const encoded = await hashPassword("青玉-secret-42");
    expect(encoded).not.toContain("青玉-secret-42");
    expect(encoded.split(":" )).toHaveLength(3);
    await expect(verifyPassword("青玉-secret-42", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong", encoded)).resolves.toBe(false);
  });
});

describe("session tokens", () => {
  it("signs, verifies, and rejects tampered tokens", async () => {
    const token = await createSessionToken("signing-secret", 1_800_000_000);
    const payload = await verifySessionToken(token, "signing-secret", 1_799_999_999);
    expect(payload?.exp).toBe(1_800_000_000);
    await expect(verifySessionToken(token + "x", "signing-secret", 1_799_999_999)).resolves.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await createSessionToken("signing-secret", 100);
    await expect(verifySessionToken(token, "signing-secret", 101)).resolves.toBeNull();
  });
});
