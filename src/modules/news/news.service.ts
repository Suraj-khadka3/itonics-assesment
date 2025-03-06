import axios from "axios";
import { Request, Response } from "express";
import { prisma } from "src/utils/prisma";
import { logErrorMessage, logInfoMessage, logWarningMessage } from "src/utils/logger";
import { ProgressTracker, SaveResult, SaveStats, WebzApiResponse } from "./dto/news.dto";

const API_URL = process.env.WEBZ_API_URL;
const API_KEY = process.env.WEBZ_API_KEY;
const NEXT_API_URL = process.env.WEBZ_NEXT_API_URL || API_URL;

/**
 * Service method to fetch news from Webz API and save to database
 * Fetches up to maxResults articles, stopping when no more results are available
 */
export const getNews = async (req: Request, res: Response) => {
  const query = req.query.q?.toString() || "LightSpeed";
  // Default to 200 per requirements
  const maxResults = Number(req.query.maxResults) || 200;
  const batchSize = 100;

  const progress: ProgressTracker = {
    totalFetched: 0,
    totalSaved: 0,
    batches: 0,
    errors: 0,
  };

  try {
    logInfoMessage(`Starting news fetch for query: "${query}", max results: ${maxResults}`);

    const { savedArticleIds, totalSaved, finalProgress } = await fetchAndSaveAllNews(
      query,
      maxResults,
      batchSize,
      progress
    );

    res.json({
      success: true,
      data: {
        totalArticlesSaved: totalSaved,
        articleIds: savedArticleIds.slice(0, 100),
      },
      meta: {
        query,
        progress: finalProgress,
        hasMore: finalProgress.totalFetched < maxResults,
        batchesProcessed: finalProgress.batches,
        totalErrors: finalProgress.errors,
      },
    });
  } catch (error) {
    handleApiError(error, res, progress);
  }
};

/**
 * Fetches and saves all news articles up to maxResults or until no more are available
 * Uses moreResultsAvailable from the API to determine when to stop
 */
async function fetchAndSaveAllNews(
  query: string | number,
  maxResults: number,
  batchSize: number,
  progress: ProgressTracker
): Promise<{ savedArticleIds: string[]; totalSaved: number; finalProgress: ProgressTracker }> {
  let currentUrl = API_URL;
  const initialParams = {
    token: API_KEY,
    q: `"${query}"`,
    size: batchSize,
  };

  let totalSaved = 0;
  const savedArticleIds: string[] = [];
  let hasMoreResults = true;

  const MAX_RETRIES = 3;
  let retryCount = 0;

  // Continue fetching until we reach maxResults or no more results are available
  while (hasMoreResults && totalSaved < maxResults) {
    try {
      logInfoMessage(`Fetching batch ${progress.batches + 1}, URL: ${currentUrl}`);

      const response = await fetchNewsBatch(currentUrl, initialParams, progress.batches === 0);
      const apiResponse = response.data;

      retryCount = 0;

      const newsArticles = apiResponse.posts || [];
      progress.totalFetched += newsArticles.length;
      progress.batches++;

      logInfoMessage(`Fetched ${newsArticles.length} articles (total ${progress.totalFetched})`);

      const { newlySavedCount, savedIds } = await processAndSaveArticles(newsArticles, progress);

      totalSaved += newlySavedCount;
      savedArticleIds.push(...savedIds);

      // Check if more results are available via the dedicated field
      hasMoreResults = !!apiResponse.moreResultsAvailable && Number(apiResponse.moreResultsAvailable) > 0;
      if (hasMoreResults == false){
        console.log("breaking")
        break;
      } 

      if (hasMoreResults && apiResponse.next && totalSaved < maxResults) {
        currentUrl = buildNextUrl(apiResponse.next);
        logInfoMessage(
          `Next pagination URL: ${currentUrl}, More results available: ${apiResponse.moreResultsAvailable}`
        );
      } else {
        hasMoreResults = false;
        logInfoMessage(`No more results available or reached maximum of ${maxResults} results`);
      }

      // Incase of API rate limits
      await delay(1500);
    } catch (requestError) {
      retryCount++;

      if (retryCount > MAX_RETRIES) {
        logErrorMessage(`Max retries exceeded for URL: ${currentUrl}`, requestError);
        hasMoreResults = false;
      } else {
        logWarningMessage(`Request failed, retrying (${retryCount}/${MAX_RETRIES}): ${currentUrl}`, requestError);
        await delay(3000 * retryCount);
      }

      progress.errors++;
    }
  }

  return { savedArticleIds, totalSaved, finalProgress: progress };
}

async function fetchNewsBatch(url: string, params: any, isFirstBatch: boolean): Promise<{ data: WebzApiResponse }> {
  if (isFirstBatch) {
    return axios.get<WebzApiResponse>(url, {
      params,
      timeout: 15000,
    });
  } else {
    return axios.get<WebzApiResponse>(url, {
      timeout: 15000,
    });
  }
}

async function processAndSaveArticles(
  articles: any[],
  progress: ProgressTracker
): Promise<{ newlySavedCount: number; savedIds: string[] }> {
  const DB_BATCH_SIZE = 10;
  let newlySavedCount = 0;
  const savedIds: string[] = [];

  for (let i = 0; i < articles.length; i += DB_BATCH_SIZE) {
    const batch = articles.slice(i, i + DB_BATCH_SIZE);
    const { saveStats, batchSavedIds } = await saveArticleBatch(batch);

    newlySavedCount += saveStats.saved;
    savedIds.push(...batchSavedIds);
    progress.totalSaved += saveStats.saved;
    progress.errors += saveStats.errors;

    logInfoMessage(
      `Database batch processed - Saved: ${saveStats.saved}, Duplicates: ${saveStats.duplicates}, Errors: ${saveStats.errors}`
    );
  }

  return { newlySavedCount, savedIds };
}

async function saveArticleBatch(batch: any[]): Promise<{ saveStats: SaveStats; batchSavedIds: string[] }> {
  const batchSaveResults = await Promise.allSettled(batch.map(async (article: any) => await saveArticle(article)));

  const saveStats = {
    saved: 0,
    duplicates: 0,
    errors: 0,
  };

  const batchSavedIds: string[] = [];

  batchSaveResults.forEach((result) => {
    if (result.status === "fulfilled") {
      if (result.value.status === "saved" && result.value.id) {
        saveStats.saved++;
        batchSavedIds.push(result.value.id);
      } else if (result.value.status === "duplicate") {
        saveStats.duplicates++;
      } else {
        saveStats.errors++;
      }
    } else {
      saveStats.errors++;
    }
  });

  return { saveStats, batchSavedIds };
}

async function saveArticle(article: any): Promise<SaveResult> {
  try {
    const existingArticle = await prisma.thread.findUnique({
      where: { url: article.url },
    });

    if (existingArticle) {
      return { status: "duplicate", id: existingArticle.id };
    }

    const savedThread = await prisma.thread.create({
      data: {
        url: article.url || "",
        siteFull: article.site?.domain || "",
        site: article.site?.name || "",
        siteCategories: { set: article.categories || [] },
        title: article.title || "",
        titleFull: article.title || "",
        published: new Date(article.published || Date.now()),
        repliesCount: article.replies_count || 0,
        participantsCount: article.participants_count || 0,
        siteType: article.site_type || "news",
        country: article.country || "",
        mainImage: article.main_image || "",
        performanceScore: article.performance_score || 0,
        domainRank: article.domain_rank || 0,
        domainRankUpdated: new Date(),
      },
    });

    if (article.thread?.social && (article.thread.social.facebook || article.thread.social.vk)) {
      await saveSocialData(savedThread.id, article.thread.social);
    }

    return { status: "saved", id: savedThread.id };
  } catch (saveError) {
    logErrorMessage(`Error saving article: ${article.url}`, saveError);
    return { status: "error", error: saveError };
  }
}

async function saveSocialData(threadId: string, socialData: any): Promise<void> {
  try {
    await prisma.social.create({
      data: {
        updated: new Date(),
        thread: { connect: { id: threadId } },

        facebook: socialData.facebook
          ? {
              create: {
                likes: socialData.facebook.likes || 0,
                comments: socialData.facebook.comments || 0,
                shares: socialData.facebook.shares || 0,
              },
            }
          : undefined,

        vk: socialData.vk
          ? {
              create: {
                shares: socialData.vk.shares || 0,
              },
            }
          : undefined,
      },
    });
  } catch (error) {
    logErrorMessage(`Error saving social data for thread ${threadId}`, error);
    throw error;
  }
}

function buildNextUrl(nextPath: string): string {
  return nextPath.startsWith("http") ? nextPath : `${NEXT_API_URL}${nextPath}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function handleApiError(error: any, res: Response, progress: ProgressTracker): void {
  if (axios.isAxiosError(error)) {
    logErrorMessage(`API request failed: ${error.message}`, error, {
      status: error.response?.status,
      data: error.response?.data,
    });

    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: statusCode,
      progress,
    });
  } else {
    logErrorMessage(`Unexpected error`, error);

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred",
      code: 500,
      progress,
    });
  }
}
