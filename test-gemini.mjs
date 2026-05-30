import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.log("No API key found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    console.log("Testing gemini-3.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent("Hello");
    console.log("Success with gemini-3.5-flash!");
    console.log("Response:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-3.5-flash:", e.message);
  }
}

run();
