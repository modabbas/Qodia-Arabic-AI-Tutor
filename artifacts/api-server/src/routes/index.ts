import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import learningRouter from "./learning";
import generatedSessionRouter from "./generated-session";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(learningRouter);
router.use(generatedSessionRouter);

export default router;
