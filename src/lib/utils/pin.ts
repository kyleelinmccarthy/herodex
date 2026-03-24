import bcrypt from "bcryptjs";

const PIN_SALT_ROUNDS = 10;
const PIN_PATTERN = /^\d{4,6}$/;

export function validatePin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!validatePin(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  return bcrypt.hash(pin, PIN_SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
