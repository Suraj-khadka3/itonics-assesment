-- CreateTable
CREATE TABLE "Thread" (
    "uuid" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "siteFull" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "siteSection" TEXT,
    "siteCategories" TEXT[],
    "sectionTitle" TEXT,
    "title" TEXT NOT NULL,
    "titleFull" TEXT NOT NULL,
    "published" TIMESTAMP(3) NOT NULL,
    "repliesCount" INTEGER NOT NULL,
    "participantsCount" INTEGER NOT NULL,
    "siteType" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "mainImage" TEXT NOT NULL,
    "performanceScore" INTEGER NOT NULL,
    "domainRank" INTEGER NOT NULL,
    "domainRankUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Social" (
    "threadUuid" TEXT NOT NULL,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Social_pkey" PRIMARY KEY ("threadUuid")
);

-- CreateTable
CREATE TABLE "Facebook" (
    "threadUuid" TEXT NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,

    CONSTRAINT "Facebook_pkey" PRIMARY KEY ("threadUuid")
);

-- CreateTable
CREATE TABLE "VK" (
    "threadUuid" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,

    CONSTRAINT "VK_pkey" PRIMARY KEY ("threadUuid")
);

-- AddForeignKey
ALTER TABLE "Social" ADD CONSTRAINT "Social_threadUuid_fkey" FOREIGN KEY ("threadUuid") REFERENCES "Thread"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facebook" ADD CONSTRAINT "Facebook_threadUuid_fkey" FOREIGN KEY ("threadUuid") REFERENCES "Social"("threadUuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VK" ADD CONSTRAINT "VK_threadUuid_fkey" FOREIGN KEY ("threadUuid") REFERENCES "Social"("threadUuid") ON DELETE RESTRICT ON UPDATE CASCADE;
