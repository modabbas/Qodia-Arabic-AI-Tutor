import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import learningRouter from "./learning";
import generatedSessionRouter from "./generated-session";
import learningMapRouter from "./learning-map";
import touch4SupportRouter from "./touch4-support";
import defenseRouter from "./defense";
import prideMomentRouter from "./pride-moment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(learningRouter);
router.use(learningMapRouter);
router.use(generatedSessionRouter);
router.use(touch4SupportRouter);
router.use(defenseRouter);
router.use(prideMomentRouter);

export default router;
