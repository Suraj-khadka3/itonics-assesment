/*
  Warnings:

  - The primary key for the `Facebook` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `threadUuid` on the `Facebook` table. All the data in the column will be lost.
  - The primary key for the `Social` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `threadUuid` on the `Social` table. All the data in the column will be lost.
  - You are about to drop the column `sectionTitle` on the `Thread` table. All the data in the column will be lost.
  - You are about to drop the column `siteSection` on the `Thread` table. All the data in the column will be lost.
  - The primary key for the `VK` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `threadUuid` on the `VK` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[socialId]` on the table `Facebook` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[threadId]` on the table `Social` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[socialId]` on the table `Thread` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[socialId]` on the table `VK` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `Facebook` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `socialId` to the `Facebook` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `Social` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `threadId` to the `Social` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `VK` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `socialId` to the `VK` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Facebook" DROP CONSTRAINT "Facebook_threadUuid_fkey";

-- DropForeignKey
ALTER TABLE "Social" DROP CONSTRAINT "Social_threadUuid_fkey";

-- DropForeignKey
ALTER TABLE "VK" DROP CONSTRAINT "VK_threadUuid_fkey";

-- AlterTable
ALTER TABLE "Facebook" DROP CONSTRAINT "Facebook_pkey",
DROP COLUMN "threadUuid",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "socialId" TEXT NOT NULL,
ADD CONSTRAINT "Facebook_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Social" DROP CONSTRAINT "Social_pkey",
DROP COLUMN "threadUuid",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "threadId" TEXT NOT NULL,
ADD CONSTRAINT "Social_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Thread" DROP COLUMN "sectionTitle",
DROP COLUMN "siteSection",
ADD COLUMN     "socialId" TEXT,
ALTER COLUMN "siteFull" DROP NOT NULL,
ALTER COLUMN "site" DROP NOT NULL,
ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "mainImage" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VK" DROP CONSTRAINT "VK_pkey",
DROP COLUMN "threadUuid",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "socialId" TEXT NOT NULL,
ADD CONSTRAINT "VK_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "Facebook_socialId_key" ON "Facebook"("socialId");

-- CreateIndex
CREATE UNIQUE INDEX "Social_threadId_key" ON "Social"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "Thread_socialId_key" ON "Thread"("socialId");

-- CreateIndex
CREATE UNIQUE INDEX "VK_socialId_key" ON "VK"("socialId");

-- AddForeignKey
ALTER TABLE "Social" ADD CONSTRAINT "Social_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facebook" ADD CONSTRAINT "Facebook_socialId_fkey" FOREIGN KEY ("socialId") REFERENCES "Social"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VK" ADD CONSTRAINT "VK_socialId_fkey" FOREIGN KEY ("socialId") REFERENCES "Social"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
