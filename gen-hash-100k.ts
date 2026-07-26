
import { hashPassword, verifyPassword } from "./src/worker/auth";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npx tsx gen-hash-100k.ts '<a new admin password>'");
  process.exit(1);
}

const hash = await hashPassword(password);
console.log(hash);
console.log("verify=" + await verifyPassword(password, hash));
