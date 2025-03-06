/*
  Warnings:

  - The primary key for the `Thread` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `uuid` on the `Thread` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[url]` on the table `Thread` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `Thread` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "Social" DROP CONSTRAINT "Social_threadUuid_fkey";

-- AlterTable
ALTER TABLE "Thread" DROP CONSTRAINT "Thread_pkey",
DROP COLUMN "uuid",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "Thread_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "Thread_url_key" ON "Thread"("url");

-- AddForeignKey
ALTER TABLE "Social" ADD CONSTRAINT "Social_threadUuid_fkey" FOREIGN KEY ("threadUuid") REFERENCES "Thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
