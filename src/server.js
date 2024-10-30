import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import "dotenv/config";
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

const allowedOrigins = ["https://blog-app-frontend-teal-kappa.vercel.app/"];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Middleware for token verification
app.use(async (req, res, next) => {
  const { authtoken } = req.headers;

  if (authtoken) {
    try {
      // Verify the token using Firebase Admin SDK
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (e) {
      console.error("Error verifying token:", e);
      return res.sendStatus(400); 
    }
  } else {
    req.user = {}; 
  }
  next();
});

// Route to get article information
app.get("/api/articles/:name", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user; // Extract uid from the token

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

// Middleware to protect routes (only authenticated users can proceed)
app.use((req, res, next) => {
  if (req.user.uid) {
    next();
  } else {
    res.sendStatus(401); 
  }
});

// Route to handle upvoting
app.put("/api/articles/:name/upvote", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  try {
    const article = await db.collection("articles").findOne({ name });

    if (!article) {
      return res.status(404).json({ message: "That article doesn't exist" });
    }

    const upvoteIds = article.upvoteIds || [];
    const canUpvote = uid && !upvoteIds.includes(uid); // Ensure user hasn't already upvoted

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

// Route to handle comments
app.post("/api/articles/:name/comments", async (req, res) => {
  const { name } = req.params;
  const { text } = req.body;
  const { email } = req.user; 

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

// Server setup
const PORT = process.env.PORT || 8000;
connectToDb(() => {
  console.log("Successfully connected to database!");
  app.listen(PORT, () => {
    console.log("Server is running on port " + PORT);
  });
});
