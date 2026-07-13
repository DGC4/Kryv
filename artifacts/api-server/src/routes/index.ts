import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import categoriesRouter from "./categories";
import discoverRouter from "./discover";
import channelsRouter from "./channels";
import chatRouter from "./chat";
import videosRouter from "./videos";
import cinemaRouter from "./cinema";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(categoriesRouter);
router.use(discoverRouter);
router.use(channelsRouter);
router.use(chatRouter);
router.use(videosRouter);
router.use(cinemaRouter);

export default router;
