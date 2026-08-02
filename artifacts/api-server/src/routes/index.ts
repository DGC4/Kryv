import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import categoriesRouter from "./categories";
import discoverRouter from "./discover";
import channelsRouter from "./channels";
import chatRouter from "./chat";
import videosRouter from "./videos";
import cinemaRouter from "./cinema";
import adminRouter from "./admin";
import locationRouter from "./location";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

// This route receives the raw, signature-verified Mux payload registered in
// app.ts before JSON parsing. It is the source of truth for live/offline state.
router.use(webhooksRouter);
router.use(healthRouter);
router.use(meRouter);
router.use(categoriesRouter);
router.use(discoverRouter);
router.use(channelsRouter);
router.use(chatRouter);
router.use(videosRouter);
router.use(cinemaRouter);
router.use(adminRouter);
router.use(locationRouter);

export default router;
