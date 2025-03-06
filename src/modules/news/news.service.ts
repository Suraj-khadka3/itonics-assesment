import axios from "axios";
import { Request, Response } from "express";
import { prisma } from "src/utils/prisma";
import logger from "src/utils/logger";

const API_URL = process.env.WEBZ_API_URL;
const API_KEY = process.env.WEBZ_API_KEY;

interface WebzApiResponse {
  news: any[];
  next: string | null;
  totalResults: number;
}

export const getNews = async (req: Request, res: Response) => {
  const query = req.query.q || "LightSpeed";
  const maxResults = Number(req.query.maxResults) || 50000; // Set a reasonable default
  const batchSize = 10; // API returns 10 posts per call

  // Track progress for potential response streaming
  let progress = {
    totalFetched: 0,
    totalSaved: 0,
    batches: 0,
    errors: 0,
  };

  try {
    logger.info(`Starting news fetch for query: "${query}", max results: ${maxResults}`, {
      service: "news-api",
      timestamp: new Date().toISOString(),
    });

    // Start with the base URL
    let currentUrl = API_URL;

    // Initial request with properly formatted parameters
    const initialParams = {
      token: API_KEY,
      q: `"${query}"`,
      size: batchSize, // Ensure we're requesting the proper batch size
    };

    let totalSaved = 0;
    const savedArticleIds = []; // Store IDs instead of full objects to save memory
    let hasMore = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // Continue until we've saved max results or there are no more results
    while (hasMore && totalSaved < maxResults) {
      try {
        logger.info(`Fetching batch ${progress.batches + 1}, URL: ${currentUrl}`, {
          service: "news-api",
          timestamp: new Date().toISOString(),
        });

        // For the first request, use params object. For subsequent requests, use the full URL
        let response;
        if (progress.batches === 0) {
          response = await axios.get<WebzApiResponse>(currentUrl, {
            params: initialParams,
            timeout: 15000, // Increased timeout for potentially large responses
          });
        } else {
          // For subsequent requests, use the full URL without adding params again
          response = await axios.get<WebzApiResponse>(currentUrl, {
            timeout: 15000,
          });
        }

        // Reset retry counter on success
        retryCount = 0;

        const newsArticles = response.data.posts || [];
        progress.totalFetched += newsArticles.length;
        progress.batches++;

        logger.info(`Fetched ${newsArticles.length} articles (total ${progress.totalFetched})`, {
          service: "news-api",
          timestamp: new Date().toISOString(),
        });

        // Process in smaller sub-batches to avoid overwhelming the database
        const DB_BATCH_SIZE = 10;
        for (let i = 0; i < newsArticles.length; i += DB_BATCH_SIZE) {
          const batch = newsArticles.slice(i, i + DB_BATCH_SIZE);

          // Process the sub-batch
          const batchSaveResults = await Promise.allSettled(
            batch.map(async (article: any) => {
              try {
                // Check for duplicates before saving
                const existingArticle = await prisma.thread.findUnique({
                  where: { url: article.url || "" },
                });

                if (existingArticle) {
                  return { status: "duplicate", id: existingArticle.id };
                }

                const savedThread = await prisma.thread.create({
                  data: {
                    url: article.url || "",
                    siteFull: article.site?.domain || "",
                    site: article.site?.name || "",
                    siteCategories: { set: article.categories || [] }, // Ensure correct array handling
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
                if (article.thread.social && (article.thread.social.facebook || article.thread.social.vk)) {
                  const addedSocial = await prisma.social.create({
                    data: {
                      updated: new Date(),
                      thread: { connect: { id: savedThread.id } }, // Explicitly link to Thread

                      facebook: article.thread.social.facebook
                        ? {
                            create: {
                              likes: article.thread.social.facebook.likes || 0,
                              comments: article.thread.social.facebook.comments || 0,
                              shares: article.thread.social.facebook.shares || 0,
                            },
                          }
                        : undefined,

                      vk: article.thread.social.vk
                        ? {
                            create: {
                              shares: article.thread.social.vk.shares || 0,
                            },
                          }
                        : undefined,
                    },
                  });
                }
                console.log("added to db");

                // return { status: "saved", id: savedThread.id };
              } catch (saveError) {
                logger.error(`Error saving article: ${article.url}`, {
                  error: saveError instanceof Error ? saveError.message : String(saveError),
                  timestamp: new Date().toISOString(),
                });
                return { status: "error", error: saveError };
              }
            })
          );

          // Process results
          const saveStats = {
            saved: 0,
            duplicates: 0,
            errors: 0,
          };

          batchSaveResults.forEach((result) => {
            if (result.status === "fulfilled") {
              if (result.value.status === "saved") {
                saveStats.saved++;
                savedArticleIds.push(result.value.id);
              } else if (result.value.status === "duplicate") {
                saveStats.duplicates++;
              } else {
                saveStats.errors++;
                progress.errors++;
              }
            } else {
              saveStats.errors++;
              progress.errors++;
            }
          });

          progress.totalSaved += saveStats.saved;
          totalSaved += saveStats.saved;

          logger.info(
            `Database batch processed - Saved: ${saveStats.saved}, Duplicates: ${saveStats.duplicates}, Errors: ${saveStats.errors}`,
            {
              service: "news-api",
              timestamp: new Date().toISOString(),
            }
          );
        }

        // Check if there's a next page and prepare the URL
        if (response.data.next && totalSaved < maxResults) {
          // Make sure we correctly handle the next URL - it could be relative or absolute
          currentUrl = response.data.next.startsWith("http")
            ? response.data.next
            : `${process.env.WEBZ_NEXT_API_URL || API_URL}${response.data.next}`;

          logger.info(`Next pagination URL: ${currentUrl}`, {
            service: "news-api",
            timestamp: new Date().toISOString(),
          });
        } else {
          hasMore = false;
          logger.info(`No more pages or reached maximum results`, {
            service: "news-api",
            timestamp: new Date().toISOString(),
          });
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (requestError) {
        retryCount++;

        if (retryCount > MAX_RETRIES) {
          logger.error(`Max retries exceeded for URL: ${currentUrl}`, {
            error: requestError instanceof Error ? requestError.message : String(requestError),
            service: "news-api",
            timestamp: new Date().toISOString(),
          });

          // Break out of the loop after too many failures
          hasMore = false;
        } else {
          logger.warn(`Request failed, retrying (${retryCount}/${MAX_RETRIES}): ${currentUrl}`, {
            error: requestError instanceof Error ? requestError.message : String(requestError),
            service: "news-api",
            timestamp: new Date().toISOString(),
          });

          // Wait longer between retries
          await new Promise((resolve) => setTimeout(resolve, 3000 * retryCount));
        }

        progress.errors++;
      }
    }

    // Final response with statistics
    res.json({
      success: true,
      data: {
        totalArticlesSaved: totalSaved,
        articleIds: savedArticleIds.slice(0, 100), // Return first 100 IDs to keep response size reasonable
      },
      meta: {
        query,
        progress,
        hasMore,
        batchesProcessed: progress.batches,
        totalErrors: progress.errors,
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`API request failed: ${error.message}`, {
        service: "news-api",
        status: error.response?.status,
        data: error.response?.data,
        timestamp: new Date().toISOString(),
      });

      const statusCode = error.response?.status || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: statusCode,
        progress, // Include progress even in error response
      });
    } else {
      logger.error(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`, {
        service: "news-api",
        timestamp: new Date().toISOString(),
      });

      res.status(500).json({
        success: false,
        error: "An unexpected error occurred",
        code: 500,
        progress, // Include progress even in error response
      });
    }
  }
};
