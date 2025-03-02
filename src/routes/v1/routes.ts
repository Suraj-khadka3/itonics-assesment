import { Router } from "express";
import newsRouter from "src/modules/news/news.controller";

const v1Router: Router = Router();

v1Router.use("/news", newsRouter);

export default v1Router;
