-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "imageUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TutorProfile" ADD COLUMN     "heroImageUrl" TEXT NOT NULL DEFAULT '';
