import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import "dotenv/config";
import { db, connectToDb } from "./db.js";

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  }),
});

const app = express();

const allowedOrigins = [
  "https://blog-app-frontend-eosin.vercel.app",
  "http://localhost:3000",
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

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

// Example route
app.get("/api", (req, res) => {
  res.send("Backend is running!");
});

const PORT = process.env.PORT || 8000;
connectToDb(() => {
  console.log("Successfully connected to database!");
  app.listen(PORT, () => {
    console.log("Server is running on port " + PORT);
  });
});
