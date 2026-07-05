import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.log("No API key found in .env. Please add GEMINI_API_KEY=your_key to .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    console.log("Listing available models...");
    // Note: listModels is not directly on genAI in the same way, 
    // but we can try to fetch them or test specific ones.
    // The most robust way to test if a model exists is to try a tiny generation.
    
    const modelsToTest = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-3.5-flash"];
    
    for (const modelName of modelsToTest) {
      try {
        console.log(`\nTesting ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("hi");
        console.log(`✅ ${modelName} works!`);
      } catch (e) {
        console.log(`❌ ${modelName} failed: ${e.message}`);
      }
    }
  } catch (e) {
    console.error("General error:", e.message);
  }
}

run();
