/**
 * Creates (or updates) an admin account.
 * Usage: node scripts/createAdmin.js "Full Name" "email@example.com" "password123"
 */
const prisma = require("../lib/db");
const { hashPassword } = require("../lib/auth");

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error('Usage: node scripts/createAdmin.js "Full Name" "email@example.com" "password"');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { name, email, passwordHash },
  });

  console.log(`Admin ready: ${admin.email} (${admin.name})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
