import { Request, Response } from "express";
import axios, { AxiosError } from "axios";

import { prisma } from "../../utils/prisma";
import { getNews, handleApiError } from "./news.service";
import { ProgressTracker } from "./dto/news.dto";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock prisma
jest.mock("../../utils/prisma.ts", () => ({
  prisma: {
    thread: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    social: {
      create: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock("../../utils/logger", () => ({
  logInfoMessage: jest.fn(),
  logErrorMessage: jest.fn(),
  logWarningMessage: jest.fn(),
}));

describe("News Service", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any = {};

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock request and response
    mockRequest = {
      query: {
        q: "TestQuery",
        maxResults: "200",
      },
    };

    responseObject = {};

    mockResponse = {
      json: jest.fn().mockImplementation((result) => {
        responseObject = result;
        return mockResponse;
      }),
      status: jest.fn().mockReturnThis(),
    };

    // Mock Axios implementation for fetching news
    mockedAxios.get.mockImplementation((url) => {
      // First request with API URL
      if (url === process.env.WEBZ_API_URL) {
        return Promise.resolve({
          data: {
            posts: Array(10)
              .fill(0)
              .map((_, i) => ({
                url: `https://example.com/article-${i}`,
                title: `Test Article ${i}`,
                site: { domain: "example.com", name: "Example" },
                published: new Date().toISOString(),
              })),
            next: "next-page-token",
            moreResultsAvailable: 190, // Indicate there are more results
          },
        });
      }
      // Subsequent requests (pagination)
      else {
        return Promise.resolve({
          data: {
            posts: Array(10)
              .fill(0)
              .map((_, i) => ({
                url: `https://example.com/next-article-${i}`,
                title: `Next Test Article ${i}`,
                site: { domain: "example.com", name: "Example" },
                published: new Date().toISOString(),
              })),
            next: null,
            moreResultsAvailable: 0, // No more results for this test
          },
        });
      }
    });

    // Mock Prisma implementations
    (prisma.thread.findUnique as jest.Mock).mockResolvedValue(null); // No existing articles
    (prisma.thread.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: `mock-id-${Math.random()}`, ...data })
    );
    (prisma.social.create as jest.Mock).mockResolvedValue({ id: "mock-social-id" });

    // Mock isAxiosError for error handling tests
    //@ts-ignore
    mockedAxios.isAxiosError = jest.fn((payload): payload is AxiosError => false);
  });

  describe("getNews", () => {
    it("should fetch news articles and save them to the database", async () => {
      await getNews(mockRequest as Request, mockResponse as Response);

      // Verify API was called correctly
      expect(mockedAxios.get).toHaveBeenCalledWith(
        process.env.WEBZ_API_URL,
        expect.objectContaining({
          params: expect.objectContaining({
            q: '"TestQuery"',
            size: 100, // Should use our new batch size
          }),
        })
      );

      // Verify response format
      expect(responseObject).toHaveProperty("success", true);
      expect(responseObject).toHaveProperty("data.totalArticlesSaved");
      expect(responseObject).toHaveProperty("data.articleIds");
      expect(responseObject).toHaveProperty("meta.query", "TestQuery");
    });
    it("should handle database duplicates correctly", async () => {
      // First article will be a duplicate
      (prisma.thread.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "existing-id",
        url: "https://example.com/article-1",
      });

      await getNews(mockRequest as Request, mockResponse as Response);

      // Service should still complete successfully
      expect(responseObject).toHaveProperty("success", true);
    });

    // Need to debug this part

    it("should stop fetching when moreResultsAvailable is 0", async () => {
      // First response indicates no more results
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          posts: Array(10)
            .fill(0)
            .map((_, i) => ({
              url: `https://example.com/article-${i}`,
              title: `Test Article ${i}`,
            })),
          next: `https://example.com/article-${9}`,
          moreResultsAvailable: 10,
        },
      });

      await getNews(mockRequest as Request, mockResponse as Response);

      // Should only make one API call
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(responseObject).toHaveProperty("meta.hasMore", false);
    });

    it("should handle retry logic on temporary failures", async () => {
      // First call fails, second succeeds
      const error = new Error("Network Error");
      mockedAxios.get.mockRejectedValueOnce(error).mockResolvedValueOnce({
        data: {
          posts: [{ url: "https://example.com/article-1", title: "Article 1" }],
          next: null,
          moreResultsAvailable: 0,
        },
      });

      await getNews(mockRequest as Request, mockResponse as Response);

      // Should still succeed after retry
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(responseObject).toHaveProperty("success", true);
    });
  });

  describe("handleApiError", () => {
    it("should format axios errors correctly", () => {
      const error = new Error("API Error");
      const axiosError = {
        ...error,
        response: { status: 429, data: { message: "Rate limited" } },
      };

      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      const progress: ProgressTracker = { totalFetched: 10, totalSaved: 5, batches: 1, errors: 1 };

      handleApiError(axiosError, mockResponse as Response, progress);

      // Should return the API status code
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(responseObject).toHaveProperty("success", false);
      expect(responseObject).toHaveProperty("progress", progress);
    });

    it("should handle generic errors with 500 status code", () => {
      const error = new Error("General Error");

      const progress: ProgressTracker = { totalFetched: 10, totalSaved: 5, batches: 1, errors: 1 };

      handleApiError(error, mockResponse as Response, progress);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(responseObject).toHaveProperty("error", "An unexpected error occurred");
    });
  });
});
