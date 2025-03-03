import axios from "axios";
import { Request, Response } from "express";
import logger from "src/utils/logger";

const API_URL = process.env.WEBZ_API_URL;
const API_KEY = process.env.WEBZ_API_KEY;

export const getNews = async (req: Request, res: Response) => {
  const query = req.query.q || "Bitcoin";

  try {
    logger.info(`getNews query: ${JSON.stringify(query)}`);

    const response = await axios.get(API_URL, {
      params: {
        token: API_KEY,
        q: JSON.stringify(query),
      },
      timeout: 10000, // 10 seconds
    });

    console.log(`full Url: ${axios.getUri(response.config)}`);

    logger.info(`Successfully fetched ${response.data.news?.length || 0} news articles`);

    res.json({
      success: true,
      data: response.data,
      meta: {
        query,
      },
    });
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error)) {
      logger.error(`API request failed: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data,
      });

      const statusCode = error.response?.status || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: statusCode,
      });
    } else {
      logger.error(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`);
      res.status(500).json({
        success: false,
        error: "An unexpected error occurred",
        code: 500,
      });
    }
  }
};
