import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.log("No API key found in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
  try {
    console.log("Testing gemini-3.5-flash...");
    await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello"
    });
    console.log("Success with gemini-3.5-flash!");
  } catch (e) {
    console.error("Error with gemini-3.5-flash:", e.status, e.message);
  }

  try {
    console.log("\nTesting gemini-2.5-flash...");
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello"
    });
    console.log("Success with gemini-2.5-flash!");
  } catch (e) {
    console.error("Error with gemini-2.5-flash:", e.status, e.message);
  }
}

run();
