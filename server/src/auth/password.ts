import bcrypt from "bcryptjs";

const SALT_ROUNDS = process.env.NODE_ENV === "test" ? 4 : 12;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
