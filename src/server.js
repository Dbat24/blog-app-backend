import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import "dotenv/config";
import { db, connectToDb } from "./db.js";

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credentials = JSON.parse(fs.readFileSync("./credentials.json"));
admin.initializeApp({
  credential: admin.credential.cert(credentials),
});
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../build")));

app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

app.use(async (req, res, next) => {
  const { authtoken } = req.headers;

  if (authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (e) {
      return res.sendStatus(400);
    }
  }
  req.user = req.user || {};
  next();
});

app.get("/api/articles/:name", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;
  try {
    const article = await db.collection("articles").findOne({ name });
    if (article) {
      const upvoteIds = article.upvoteIds || [];
      article.canUpvote = uid && !upvoteIds.includes(uid);
      res.json(article);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error("Error fetching article:", error);
    res.sendStatus(500);
  }
});

app.use((req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.sendStatus(401);
  }
});

app.put("/api/articles/:name/upvote", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  try {
    const article = await db.collection("articles").findOne({ name });

    if (!article) {
      return res.status(404).json({ message: "That article doesn't exist" });
    }

    const upvoteIds = article.upvoteIds || [];
    const canUpvote = uid && !upvoteIds.includes(uid);

    if (canUpvote) {
      await db.collection("articles").updateOne(
        { name },
        {
          $inc: { upvotes: 1 },
          $push: { upvoteIds: uid },
        }
      );
    }

    const updatedArticle = await db.collection("articles").findOne({ name });
    res.json(updatedArticle);
  } catch (error) {
    console.error("Error upvoting article:", error);
    res.status(500).json({ message: "Error upvoting article" });
  }
});

app.post("/api/articles/:name/comments", async (req, res) => {
  const { name } = req.params;
  const { text } = req.body;
  const { email } = req.user; // Assumes authentication middleware sets req.user

  // Input validation
  if (!email || !text) {
    return res
      .status(400)
      .json({ error: "Both email (postedBy) and text are required" });
  }

  try {
    const result = await db
      .collection("articles")
      .updateOne({ name }, { $push: { comments: { postedBy: email, text } } });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Article not found" });
    }

    const article = await db.collection("articles").findOne({ name });
    res.json(article);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Error adding comment" });
  }
});

const PORT = process.env.PORT || 8000;
connectToDb(() => {
  console.log("Successfully connected to database!");
  app.listen(PORT, () => {
    console.log("Server is running on port " + PORT);
  });
});
