import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import learningRouter from "./learning";
import generatedSessionRouter from "./generated-session";
import learningMapRouter from "./learning-map";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(learningRouter);
router.use(learningMapRouter);
router.use(generatedSessionRouter);

export default router;
