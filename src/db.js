import { MongoClient } from "mongodb";

let db;
const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.ajc7z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);

async function connectToDb(cb) {
  try {
    if (db) {
      // If already connected, invoke callback directly
      return cb();
    } 
    await client.connect();
    db = client.db("react-blog-db");
    console.log("Connected to MongoDB");
    cb();
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

export { db, connectToDb };