import { Router } from "express";
import v1Router from "src/routes/v1/routes";

const router = Router();

router.use("/v1", v1Router);

export default router;
