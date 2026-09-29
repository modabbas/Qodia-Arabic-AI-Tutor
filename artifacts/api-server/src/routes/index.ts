import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import learningRouter from "./learning";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(learningRouter);

export default router;
