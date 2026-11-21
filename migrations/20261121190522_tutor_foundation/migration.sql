/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'done', 'dismissed');

-- CreateEnum
CREATE TYPE "SessionTypeModeType" AS ENUM ('online', 'in_person', 'either');

-- CreateEnum
CREATE TYPE "WeeklyHoursDayOfWeekType" AS ENUM ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');

-- CreateEnum
CREATE TYPE "FamilyStatusType" AS ENUM ('lead', 'active', 'paused', 'former', 'blocked');

-- CreateEnum
CREATE TYPE "FamilyBillingModeType" AS ENUM ('pay_as_you_book', 'invoice', 'flat_monthly');

-- CreateEnum
CREATE TYPE "StudentStatusType" AS ENUM ('active', 'paused', 'finished');

-- CreateEnum
CREATE TYPE "InquiryStatusType" AS ENUM ('new', 'contacted', 'converted', 'closed');

-- CreateEnum
CREATE TYPE "ReviewStatusType" AS ENUM ('pending', 'published', 'hidden');

-- CreateEnum
CREATE TYPE "SessionModeType" AS ENUM ('online', 'in_person');

-- CreateEnum
CREATE TYPE "SessionStatusType" AS ENUM ('pending_payment', 'scheduled', 'completed', 'cancelled', 'late_cancelled', 'no_show', 'excused', 'released');

-- CreateEnum
CREATE TYPE "SessionFundingType" AS ENUM ('package', 'card', 'invoice', 'flat', 'free');

-- CreateEnum
CREATE TYPE "SessionSourceType" AS ENUM ('online', 'tutor', 'series');

-- CreateEnum
CREATE TYPE "SessionBillableType" AS ENUM ('no', 'yes');

-- CreateEnum
CREATE TYPE "SessionPaymentStatusType" AS ENUM ('not_due', 'unpaid', 'paid', 'refunded', 'part_refunded');

-- CreateEnum
CREATE TYPE "SessionCancelledByType" AS ENUM ('none', 'guardian', 'tutor', 'system');

-- CreateEnum
CREATE TYPE "HomeworkStatusType" AS ENUM ('assigned', 'handed_in', 'reviewed');

-- CreateEnum
CREATE TYPE "RecurringSeriesModeType" AS ENUM ('online', 'in_person');

-- CreateEnum
CREATE TYPE "RecurringSeriesStatusType" AS ENUM ('active', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "PackagePurchaseStatusType" AS ENUM ('awaiting_payment', 'active', 'used_up', 'expired', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "CreditEntryKindType" AS ENUM ('grant', 'hold', 'release', 'debit', 'reversal', 'expire', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "InvoiceStatusType" AS ENUM ('draft', 'sent', 'paid', 'void');

-- CreateEnum
CREATE TYPE "PaymentKindType" AS ENUM ('session', 'package', 'invoice', 'refund');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('stripe', 'cash', 'bank_transfer', 'mobile_money', 'other');

-- CreateEnum
CREATE TYPE "PaymentStatusType" AS ENUM ('reported', 'confirmed', 'rejected', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "PaymentSessionTargetType" AS ENUM ('session', 'package', 'invoice');

-- CreateEnum
CREATE TYPE "PaymentSessionStatusType" AS ENUM ('pending', 'captured', 'expired', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "ExpenseCategoryType" AS ENUM ('travel', 'materials', 'software', 'room', 'other');

-- CreateEnum
CREATE TYPE "NotificationLogStatusType" AS ENUM ('sent', 'failed', 'skipped');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canManageAllTodos",
ADD COLUMN     "canManageBusiness" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageFamilies" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSessions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewEarnings" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingStatus" "UserOnboardingStatusType" DEFAULT 'not_started';

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "TutorProfile" (
    "id" TEXT NOT NULL,
    "owner" TEXT,
    "businessName" TEXT NOT NULL DEFAULT '',
    "tutorName" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "headline" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "qualifications" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "teachesOnline" BOOLEAN NOT NULL DEFAULT true,
    "teachesInPerson" BOOLEAN NOT NULL DEFAULT false,
    "inPersonArea" TEXT NOT NULL DEFAULT '',
    "defaultMeetingUrl" TEXT NOT NULL DEFAULT '',
    "bookingOpen" BOOLEAN NOT NULL DEFAULT true,
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 12,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "cancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
    "lateCancelPercent" INTEGER NOT NULL DEFAULT 100,
    "noShowPercent" INTEGER NOT NULL DEFAULT 100,
    "unpaidHoldMinutes" INTEGER NOT NULL DEFAULT 60,
    "reschedulesAllowed" INTEGER NOT NULL DEFAULT 2,
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "policiesText" TEXT NOT NULL DEFAULT '',
    "invoiceDueDays" INTEGER NOT NULL DEFAULT 7,
    "invoiceCounter" INTEGER NOT NULL DEFAULT 0,
    "reviewsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "calendarTokenHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "levels" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionType" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "mode" "SessionTypeModeType" NOT NULL DEFAULT 'online',
    "openToNewFamilies" BOOLEAN NOT NULL DEFAULT false,
    "maxStudents" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyHours" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "dayOfWeek" "WeeklyHoursDayOfWeekType" NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "startMinute" INTEGER NOT NULL DEFAULT 900,
    "endMinute" INTEGER NOT NULL DEFAULT 1200,
    "breakStartMinute" INTEGER,
    "breakEndMinute" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "minutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "validMonths" INTEGER NOT NULL DEFAULT 12,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "secondContactName" TEXT NOT NULL DEFAULT '',
    "secondContactPhone" TEXT NOT NULL DEFAULT '',
    "status" "FamilyStatusType" NOT NULL DEFAULT 'lead',
    "billingMode" "FamilyBillingModeType" NOT NULL DEFAULT 'pay_as_you_book',
    "monthlyFeeCents" INTEGER NOT NULL DEFAULT 0,
    "address" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT '',
    "howTheyFoundMe" TEXT NOT NULL DEFAULT '',
    "privateNotes" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "inviteTokenHash" TEXT NOT NULL DEFAULT '',
    "calendarTokenHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "family" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT '',
    "school" TEXT NOT NULL DEFAULT '',
    "birthYear" INTEGER,
    "goals" TEXT NOT NULL DEFAULT '',
    "needs" TEXT NOT NULL DEFAULT '',
    "meetingUrl" TEXT NOT NULL DEFAULT '',
    "status" "StudentStatusType" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "studentLevel" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" "InquiryStatusType" NOT NULL DEFAULT 'new',
    "family" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "family" TEXT,
    "displayName" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" "ReviewStatusType" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "family" TEXT,
    "sessionType" TEXT,
    "series" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "mode" "SessionModeType" NOT NULL DEFAULT 'online',
    "meetingUrl" TEXT NOT NULL DEFAULT '',
    "locationText" TEXT NOT NULL DEFAULT '',
    "status" "SessionStatusType" NOT NULL DEFAULT 'scheduled',
    "funding" "SessionFundingType" NOT NULL DEFAULT 'free',
    "source" "SessionSourceType" NOT NULL DEFAULT 'tutor',
    "typeNameSnapshot" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "chargedCents" INTEGER NOT NULL DEFAULT 0,
    "chargedMinutes" INTEGER NOT NULL DEFAULT 0,
    "billable" "SessionBillableType" NOT NULL DEFAULT 'no',
    "paymentStatus" "SessionPaymentStatusType" NOT NULL DEFAULT 'not_due',
    "holdEndsAt" TIMESTAMP(3) NOT NULL,
    "guardianMessage" TEXT NOT NULL DEFAULT '',
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "cancelledBy" "SessionCancelledByType" NOT NULL DEFAULT 'none',
    "cancelledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "rescheduledFrom" TIMESTAMP(3) NOT NULL,
    "reminderSentAt" TIMESTAMP(3) NOT NULL,
    "publicAccessTokenHash" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNote" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "covered" TEXT NOT NULL DEFAULT '',
    "wentWell" TEXT NOT NULL DEFAULT '',
    "workOnNext" TEXT NOT NULL DEFAULT '',
    "effort" INTEGER,
    "privateNote" TEXT NOT NULL DEFAULT '',
    "sharedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "student" TEXT,
    "session" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3),
    "linkUrl" TEXT NOT NULL DEFAULT '',
    "file_filesize" INTEGER,
    "file_filename" TEXT,
    "status" "HomeworkStatusType" NOT NULL DEFAULT 'assigned',
    "handedInAt" TIMESTAMP(3) NOT NULL,
    "guardianComment" TEXT NOT NULL DEFAULT '',
    "handInUrl" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressMark" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "student" TEXT,
    "label" TEXT NOT NULL DEFAULT '',
    "takenOn" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "outOf" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "linkUrl" TEXT NOT NULL DEFAULT '',
    "file_filesize" INTEGER,
    "file_filename" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSeries" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "family" TEXT,
    "sessionType" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "mode" "RecurringSeriesModeType" NOT NULL DEFAULT 'online',
    "startsOn" TEXT NOT NULL DEFAULT '',
    "endsOn" TEXT NOT NULL DEFAULT '',
    "status" "RecurringSeriesStatusType" NOT NULL DEFAULT 'active',
    "generatedThrough" TEXT NOT NULL DEFAULT '',
    "skippedDates" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePurchase" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "family" TEXT,
    "package" TEXT,
    "nameSnapshot" TEXT NOT NULL DEFAULT '',
    "appliesToIds" TEXT NOT NULL DEFAULT '',
    "minutesGranted" INTEGER NOT NULL DEFAULT 0,
    "minutesRemaining" INTEGER NOT NULL DEFAULT 0,
    "pricePaidCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "status" "PackagePurchaseStatusType" NOT NULL DEFAULT 'awaiting_payment',
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "purchase" TEXT,
    "session" TEXT,
    "kind" "CreditEntryKindType" NOT NULL DEFAULT 'grant',
    "minutes" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "family" TEXT,
    "number" TEXT NOT NULL DEFAULT '',
    "status" "InvoiceStatusType" NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "periodMonth" TEXT NOT NULL DEFAULT '',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "voidedAt" TIMESTAMP(3) NOT NULL,
    "publicAccessTokenHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "invoice" TEXT,
    "session" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "family" TEXT,
    "session" TEXT,
    "purchase" TEXT,
    "invoice" TEXT,
    "refundOf" TEXT,
    "kind" "PaymentKindType" NOT NULL DEFAULT 'session',
    "method" "PaymentMethodType" NOT NULL DEFAULT 'cash',
    "status" "PaymentStatusType" NOT NULL DEFAULT 'confirmed',
    "amountCents" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "refundCount" INTEGER NOT NULL DEFAULT 0,
    "refundPendingCents" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "reference" TEXT NOT NULL DEFAULT '',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reportedByGuardian" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isInstalled" BOOLEAN NOT NULL DEFAULT true,
    "createPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "capturePaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "refundPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "getPaymentStatusFunction" TEXT NOT NULL DEFAULT 'manual',
    "generatePaymentLinkFunction" TEXT NOT NULL DEFAULT 'manual',
    "handleWebhookFunction" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "target" "PaymentSessionTargetType" NOT NULL DEFAULT 'session',
    "session" TEXT,
    "purchase" TEXT,
    "invoice" TEXT,
    "paymentProvider" TEXT,
    "status" "PaymentSessionStatusType" NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "replayKey" TEXT NOT NULL DEFAULT '',
    "providerCode" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "processedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "spentOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "ExpenseCategoryType" NOT NULL DEFAULT 'other',
    "amountCents" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "to" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "status" "NotificationLogStatusType" NOT NULL DEFAULT 'skipped',
    "error" TEXT NOT NULL DEFAULT '',
    "session" TEXT,
    "invoice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SessionType_subjects" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Package_appliesTo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Student_subjects" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Session_students" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Resource_students" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_RecurringSeries_students" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorProfile_owner_key" ON "TutorProfile"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "TutorProfile_slug_key" ON "TutorProfile"("slug");

-- CreateIndex
CREATE INDEX "Subject_profile_idx" ON "Subject"("profile");

-- CreateIndex
CREATE INDEX "SessionType_profile_idx" ON "SessionType"("profile");

-- CreateIndex
CREATE INDEX "WeeklyHours_profile_idx" ON "WeeklyHours"("profile");

-- CreateIndex
CREATE INDEX "TimeOff_profile_idx" ON "TimeOff"("profile");

-- CreateIndex
CREATE INDEX "Package_profile_idx" ON "Package"("profile");

-- CreateIndex
CREATE UNIQUE INDEX "Family_user_key" ON "Family"("user");

-- CreateIndex
CREATE INDEX "Family_profile_idx" ON "Family"("profile");

-- CreateIndex
CREATE INDEX "Family_email_idx" ON "Family"("email");

-- CreateIndex
CREATE INDEX "Student_profile_idx" ON "Student"("profile");

-- CreateIndex
CREATE INDEX "Student_family_idx" ON "Student"("family");

-- CreateIndex
CREATE INDEX "Inquiry_profile_idx" ON "Inquiry"("profile");

-- CreateIndex
CREATE INDEX "Inquiry_family_idx" ON "Inquiry"("family");

-- CreateIndex
CREATE INDEX "Review_profile_idx" ON "Review"("profile");

-- CreateIndex
CREATE INDEX "Review_family_idx" ON "Review"("family");

-- CreateIndex
CREATE UNIQUE INDEX "Session_note_key" ON "Session"("note");

-- CreateIndex
CREATE INDEX "Session_profile_idx" ON "Session"("profile");

-- CreateIndex
CREATE INDEX "Session_family_idx" ON "Session"("family");

-- CreateIndex
CREATE INDEX "Session_sessionType_idx" ON "Session"("sessionType");

-- CreateIndex
CREATE INDEX "Session_series_idx" ON "Session"("series");

-- CreateIndex
CREATE INDEX "SessionNote_profile_idx" ON "SessionNote"("profile");

-- CreateIndex
CREATE INDEX "Homework_profile_idx" ON "Homework"("profile");

-- CreateIndex
CREATE INDEX "Homework_student_idx" ON "Homework"("student");

-- CreateIndex
CREATE INDEX "Homework_session_idx" ON "Homework"("session");

-- CreateIndex
CREATE INDEX "ProgressMark_profile_idx" ON "ProgressMark"("profile");

-- CreateIndex
CREATE INDEX "ProgressMark_student_idx" ON "ProgressMark"("student");

-- CreateIndex
CREATE INDEX "Resource_profile_idx" ON "Resource"("profile");

-- CreateIndex
CREATE INDEX "RecurringSeries_profile_idx" ON "RecurringSeries"("profile");

-- CreateIndex
CREATE INDEX "RecurringSeries_family_idx" ON "RecurringSeries"("family");

-- CreateIndex
CREATE INDEX "RecurringSeries_sessionType_idx" ON "RecurringSeries"("sessionType");

-- CreateIndex
CREATE INDEX "PackagePurchase_profile_idx" ON "PackagePurchase"("profile");

-- CreateIndex
CREATE INDEX "PackagePurchase_family_idx" ON "PackagePurchase"("family");

-- CreateIndex
CREATE INDEX "PackagePurchase_package_idx" ON "PackagePurchase"("package");

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_key_key" ON "CreditEntry"("key");

-- CreateIndex
CREATE INDEX "CreditEntry_profile_idx" ON "CreditEntry"("profile");

-- CreateIndex
CREATE INDEX "CreditEntry_purchase_idx" ON "CreditEntry"("purchase");

-- CreateIndex
CREATE INDEX "CreditEntry_session_idx" ON "CreditEntry"("session");

-- CreateIndex
CREATE INDEX "Invoice_profile_idx" ON "Invoice"("profile");

-- CreateIndex
CREATE INDEX "Invoice_family_idx" ON "Invoice"("family");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_profile_number_key" ON "Invoice"("profile", "number");

-- CreateIndex
CREATE INDEX "InvoiceLine_profile_idx" ON "InvoiceLine"("profile");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoice_idx" ON "InvoiceLine"("invoice");

-- CreateIndex
CREATE INDEX "InvoiceLine_session_idx" ON "InvoiceLine"("session");

-- CreateIndex
CREATE INDEX "Payment_profile_idx" ON "Payment"("profile");

-- CreateIndex
CREATE INDEX "Payment_family_idx" ON "Payment"("family");

-- CreateIndex
CREATE INDEX "Payment_session_idx" ON "Payment"("session");

-- CreateIndex
CREATE INDEX "Payment_purchase_idx" ON "Payment"("purchase");

-- CreateIndex
CREATE INDEX "Payment_invoice_idx" ON "Payment"("invoice");

-- CreateIndex
CREATE INDEX "Payment_refundOf_idx" ON "Payment"("refundOf");

-- CreateIndex
CREATE INDEX "PaymentProvider_profile_idx" ON "PaymentProvider"("profile");

-- CreateIndex
CREATE INDEX "PaymentSession_profile_idx" ON "PaymentSession"("profile");

-- CreateIndex
CREATE INDEX "PaymentSession_session_idx" ON "PaymentSession"("session");

-- CreateIndex
CREATE INDEX "PaymentSession_purchase_idx" ON "PaymentSession"("purchase");

-- CreateIndex
CREATE INDEX "PaymentSession_invoice_idx" ON "PaymentSession"("invoice");

-- CreateIndex
CREATE INDEX "PaymentSession_paymentProvider_idx" ON "PaymentSession"("paymentProvider");

-- CreateIndex
CREATE INDEX "PaymentSession_providerPaymentId_idx" ON "PaymentSession"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_replayKey_key" ON "PaymentWebhookEvent"("replayKey");

-- CreateIndex
CREATE INDEX "Expense_profile_idx" ON "Expense"("profile");

-- CreateIndex
CREATE INDEX "NotificationLog_profile_idx" ON "NotificationLog"("profile");

-- CreateIndex
CREATE INDEX "NotificationLog_session_idx" ON "NotificationLog"("session");

-- CreateIndex
CREATE INDEX "NotificationLog_invoice_idx" ON "NotificationLog"("invoice");

-- CreateIndex
CREATE UNIQUE INDEX "_SessionType_subjects_AB_unique" ON "_SessionType_subjects"("A", "B");

-- CreateIndex
CREATE INDEX "_SessionType_subjects_B_index" ON "_SessionType_subjects"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Package_appliesTo_AB_unique" ON "_Package_appliesTo"("A", "B");

-- CreateIndex
CREATE INDEX "_Package_appliesTo_B_index" ON "_Package_appliesTo"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Student_subjects_AB_unique" ON "_Student_subjects"("A", "B");

-- CreateIndex
CREATE INDEX "_Student_subjects_B_index" ON "_Student_subjects"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Session_students_AB_unique" ON "_Session_students"("A", "B");

-- CreateIndex
CREATE INDEX "_Session_students_B_index" ON "_Session_students"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Resource_students_AB_unique" ON "_Resource_students"("A", "B");

-- CreateIndex
CREATE INDEX "_Resource_students_B_index" ON "_Resource_students"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_RecurringSeries_students_AB_unique" ON "_RecurringSeries_students"("A", "B");

-- CreateIndex
CREATE INDEX "_RecurringSeries_students_B_index" ON "_RecurringSeries_students"("B");

-- AddForeignKey
ALTER TABLE "TutorProfile" ADD CONSTRAINT "TutorProfile_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionType" ADD CONSTRAINT "SessionType_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyHours" ADD CONSTRAINT "WeeklyHours_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_sessionType_fkey" FOREIGN KEY ("sessionType") REFERENCES "SessionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_series_fkey" FOREIGN KEY ("series") REFERENCES "RecurringSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_note_fkey" FOREIGN KEY ("note") REFERENCES "SessionNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_student_fkey" FOREIGN KEY ("student") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_session_fkey" FOREIGN KEY ("session") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressMark" ADD CONSTRAINT "ProgressMark_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressMark" ADD CONSTRAINT "ProgressMark_student_fkey" FOREIGN KEY ("student") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSeries" ADD CONSTRAINT "RecurringSeries_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSeries" ADD CONSTRAINT "RecurringSeries_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSeries" ADD CONSTRAINT "RecurringSeries_sessionType_fkey" FOREIGN KEY ("sessionType") REFERENCES "SessionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_package_fkey" FOREIGN KEY ("package") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_purchase_fkey" FOREIGN KEY ("purchase") REFERENCES "PackagePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_session_fkey" FOREIGN KEY ("session") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_session_fkey" FOREIGN KEY ("session") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_family_fkey" FOREIGN KEY ("family") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_session_fkey" FOREIGN KEY ("session") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchase_fkey" FOREIGN KEY ("purchase") REFERENCES "PackagePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundOf_fkey" FOREIGN KEY ("refundOf") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProvider" ADD CONSTRAINT "PaymentProvider_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_session_fkey" FOREIGN KEY ("session") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_purchase_fkey" FOREIGN KEY ("purchase") REFERENCES "PackagePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_profile_fkey" FOREIGN KEY ("profile") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_session_fkey" FOREIGN KEY ("session") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SessionType_subjects" ADD CONSTRAINT "_SessionType_subjects_A_fkey" FOREIGN KEY ("A") REFERENCES "SessionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SessionType_subjects" ADD CONSTRAINT "_SessionType_subjects_B_fkey" FOREIGN KEY ("B") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Package_appliesTo" ADD CONSTRAINT "_Package_appliesTo_A_fkey" FOREIGN KEY ("A") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Package_appliesTo" ADD CONSTRAINT "_Package_appliesTo_B_fkey" FOREIGN KEY ("B") REFERENCES "SessionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Student_subjects" ADD CONSTRAINT "_Student_subjects_A_fkey" FOREIGN KEY ("A") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Student_subjects" ADD CONSTRAINT "_Student_subjects_B_fkey" FOREIGN KEY ("B") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Session_students" ADD CONSTRAINT "_Session_students_A_fkey" FOREIGN KEY ("A") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Session_students" ADD CONSTRAINT "_Session_students_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Resource_students" ADD CONSTRAINT "_Resource_students_A_fkey" FOREIGN KEY ("A") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Resource_students" ADD CONSTRAINT "_Resource_students_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecurringSeries_students" ADD CONSTRAINT "_RecurringSeries_students_A_fkey" FOREIGN KEY ("A") REFERENCES "RecurringSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecurringSeries_students" ADD CONSTRAINT "_RecurringSeries_students_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
