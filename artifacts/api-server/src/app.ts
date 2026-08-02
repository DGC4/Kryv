import express from "express";
import path from "path";
import fs from "fs";
const app = express();
app.get("/health", (_req, res) => res.json({ status: "ok" }));
const frontendDist = path.join(__dirname, "..", "..", "blyze", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}
export default app;
