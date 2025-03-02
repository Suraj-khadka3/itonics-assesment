import axios from "axios";
import { Request, Response } from "express";
import logger from "src/utils/logger";

const API_URL = process.env.WEBZ_API_URL;
const API_KEY = process.env.WEBZ_API_KEY;

export const getNews = async (req: Request, res: Response) => {
  const query = req.query.q || "Bitcoin";
  const limit = +req.query.limit || 10;
  const offset = req.query.offset || 0;

  if (limit > 10) {
    throw new Error("Limit cannot be greater than 10");
  }

  try {
    logger.info(`getNews query: ${JSON.stringify(query)} limit: ${limit} offset: ${offset}`);

    const response = await axios.get(API_URL, {
      params: {
        token: API_KEY,
        q: JSON.stringify(query),
        limit,
        offset,
      },
      timeout: 10000, // 10 seconds
    });

    console.log(response.config);

    logger.info(`Successfully fetched ${response.data.news?.length || 0} news articles`);

    res.json({
      success: true,
      data: response.data,
      meta: {
        query,
        limit,
        offset,
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
