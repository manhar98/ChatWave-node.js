
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // MongoDB URI check
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    // Connect MongoDB Atlas
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Atlas Connected Successfully!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

export default connectDB;
