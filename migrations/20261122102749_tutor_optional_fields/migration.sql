-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_note_fkey";

-- DropIndex
DROP INDEX "Session_note_key";

-- AlterTable
ALTER TABLE "CreditEntry" ADD COLUMN     "heldChange" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Homework" ALTER COLUMN "handedInAt" DROP NOT NULL,
ALTER COLUMN "reviewedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "issuedAt" DROP NOT NULL,
ALTER COLUMN "dueAt" DROP NOT NULL,
ALTER COLUMN "voidedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceLine" ALTER COLUMN "sortOrder" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PackagePurchase" ALTER COLUMN "purchasedAt" DROP NOT NULL,
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paidAt" DROP NOT NULL,
ALTER COLUMN "decidedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PaymentSession" ALTER COLUMN "expiresAt" DROP NOT NULL,
ALTER COLUMN "capturedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "note",
ALTER COLUMN "holdEndsAt" DROP NOT NULL,
ALTER COLUMN "cancelledAt" DROP NOT NULL,
ALTER COLUMN "completedAt" DROP NOT NULL,
ALTER COLUMN "rescheduledFrom" DROP NOT NULL,
ALTER COLUMN "reminderSentAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SessionNote" ADD COLUMN     "session" TEXT,
ALTER COLUMN "sharedAt" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SessionNote_session_key" ON "SessionNote"("session");

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_session_fkey" FOREIGN KEY ("session") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
