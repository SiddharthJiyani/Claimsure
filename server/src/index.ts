import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { isSupabaseConfigured } from "./database/supabase.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRouter from "./routes/auth.js";
import casesRouter from "./routes/cases.js";
import documentsRouter from "./routes/documents.js";
import appealsRouter from "./routes/appeals.js";
import notificationsRouter from "./routes/notifications.js";
import evalRouter from "./routes/eval.js";
import demoRouter from "./routes/demo.js";

dotenv.config();

const app = express();
const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

app.use(
  cors({
    origin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    message: "Claimsure Server is running",
    supabase: isSupabaseConfigured(),
    roles: ["patient", "insurance_provider"],
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, supabase: isSupabaseConfigured() });
});

app.use("/auth", authRouter);
app.use("/cases", casesRouter);
app.use("/documents", documentsRouter);
app.use("/appeals", appealsRouter);
app.use("/notifications", notificationsRouter);
app.use("/eval", evalRouter);
app.use("/demo", demoRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Claimsure server running on port ${PORT}`);
  if (!isSupabaseConfigured()) {
    console.warn(
      "Supabase env placeholders are still set. Update server/.env before testing auth.",
    );
  }
});
