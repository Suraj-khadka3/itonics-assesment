-- DropForeignKey
ALTER TABLE "Social" DROP CONSTRAINT "Social_threadId_fkey";

-- AddForeignKey
ALTER TABLE "Social" ADD CONSTRAINT "Social_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
