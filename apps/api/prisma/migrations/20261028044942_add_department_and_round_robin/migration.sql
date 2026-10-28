-- CreateEnum
CREATE TYPE "Department" AS ENUM ('TECHNICAL_SUPPORT', 'GENERAL');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "department" "Department" NOT NULL DEFAULT 'TECHNICAL_SUPPORT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department" "Department" DEFAULT 'TECHNICAL_SUPPORT',
ADD COLUMN     "lastAssignedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tickets_department_status_createdAt_idx" ON "tickets"("department", "status", "createdAt");
