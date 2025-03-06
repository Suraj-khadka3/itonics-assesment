import { Router } from "express";
import { getNews } from "src/modules/news/news.service";

const newsRouter: Router = Router();

//please provide query while calling this else default is LightSpeed
newsRouter.get("/", getNews);

export default newsRouter;
