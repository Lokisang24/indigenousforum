const { PrismaClient } = require("@prisma/client");

// Prevent multiple Prisma Client instances in dev (Next.js hot reload)
let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
