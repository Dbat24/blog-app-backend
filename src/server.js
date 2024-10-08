import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import "dotenv/config"; // Load environment variables
import { db, connectToDb } from "./db.js";

// Initialize Firebase Admin SDK using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // Handle newline characters
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  }),
});

const app = express();

// Configure CORS to allow requests from your frontend URL
const allowedOrigins = [
  "https://blog-app-frontend-eosin.vercel.app", // Your frontend Vercel URL
  // "http://localhost:3000" // Localhost for development
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Handle root URL
app.get("/", (req, res) => {
  res.send("Welcome to the backend API");
});

// Middleware for Firebase Auth
app.use(async (req, res, next) => {
  const { authtoken } = req.headers;

  if (authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (e) {
      return res.status(400).send("Invalid auth token");
    }
  }
  req.user = req.user || {};
  next();
});

// GET article data
app.get("/api/articles/:articleId", async (req, res) => {
  const { articleId } = req.params;

  try {
    const article = await db.collection("articles").findOne({ name: articleId });

    if (article) {
      const canUpvote = req.user ? !article.upvoteIds.includes(req.user.uid) : false;
      res.json({ ...article, canUpvote });
    } else {
      res.status(404).send("Article not found");
    }
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).send("Internal server error");
  }
});

// Upvote article
app.put("/api/articles/:articleId/upvote", async (req, res) => {
  const { articleId } = req.params;

  if (!req.user) {
    return res.status(401).send("Unauthorized: User not logged in");
  }

  try {
    const article = await db.collection("articles").findOne({ name: articleId });

    if (article) {
      const upvoteIds = article.upvoteIds || [];
      const canUpvote = !upvoteIds.includes(req.user.uid);

      if (canUpvote) {
        await db.collection("articles").updateOne(
          { name: articleId },
          {
            $inc: { upvotes: 1 },
            $push: { upvoteIds: req.user.uid },
          }
        );
      }

      const updatedArticle = await db.collection("articles").findOne({ name: articleId });
      res.json(updatedArticle);
    } else {
      res.status(404).send("Article not found");
    }
  } catch (error) {
    console.error("Error upvoting article:", error);
    res.status(500).send("Internal server error");
  }
});

// Add comment
app.post("/api/articles/:articleId/comments", async (req, res) => {
  const { articleId } = req.params;
  const { text } = req.body;

  if (!req.user) {
    return res.status(401).send("Unauthorized: User not logged in");
  }

  try {
    await db.collection("articles").updateOne(
      { name: articleId },
      {
        $push: { comments: { postedBy: req.user.email, text } },
      }
    );

    const article = await db.collection("articles").findOne({ name: articleId });

    if (article) {
      res.json(article);
    } else {
      res.status(404).send("Article not found");
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).send("Internal server error");
  }
});

// Start the server
const PORT = process.env.PORT || 8000;
connectToDb(() => {
  console.log("Successfully connected to database!");
  app.listen(PORT, () => {
    console.log("Server is running on port " + PORT);
  });
});
