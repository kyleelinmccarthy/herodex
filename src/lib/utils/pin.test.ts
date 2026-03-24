import { describe, it, expect } from "vitest";
import { validatePin, hashPin, verifyPin } from "./pin";

describe("validatePin", () => {
  it("accepts 4-digit PINs", () => {
    expect(validatePin("1234")).toBe(true);
  });

  it("accepts 5-digit PINs", () => {
    expect(validatePin("12345")).toBe(true);
  });

  it("accepts 6-digit PINs", () => {
    expect(validatePin("123456")).toBe(true);
  });

  it("rejects 3-digit PINs", () => {
    expect(validatePin("123")).toBe(false);
  });

  it("rejects 7-digit PINs", () => {
    expect(validatePin("1234567")).toBe(false);
  });

  it("rejects non-numeric PINs", () => {
    expect(validatePin("abcd")).toBe(false);
    expect(validatePin("12ab")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validatePin("")).toBe(false);
  });
});

describe("hashPin and verifyPin", () => {
  it("hashes and verifies a valid PIN", async () => {
    const pin = "1234";
    const hash = await hashPin(pin);

    expect(hash).not.toBe(pin);
    expect(await verifyPin(pin, hash)).toBe(true);
    expect(await verifyPin("0000", hash)).toBe(false);
  });

  it("throws on invalid PIN", async () => {
    await expect(hashPin("abc")).rejects.toThrow("PIN must be 4-6 digits");
  });
});
