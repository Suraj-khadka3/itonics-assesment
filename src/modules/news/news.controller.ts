import { Router } from "express";
import { getNews } from "src/modules/news/news.service";

const newsRouter: Router = Router();

newsRouter.get("/", getNews);

export default newsRouter;
