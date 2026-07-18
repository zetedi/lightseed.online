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
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  console.log("Testing role sequence: [model, user]");
  try {
    const result = await model.generateContent({
      contents: [
        { role: "model", parts: [{ text: "Hello! I am your assistant." }] },
        { role: "user", parts: [{ text: "What can you do?" }] }
      ]
    });
    console.log("✅ Sequence [model, user] worked!");
  } catch (e) {
    console.log("❌ Sequence [model, user] failed:", e.message);
  }

  console.log("\nTesting role sequence: [user, model, user]");
  try {
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: "Hi" }] },
        { role: "model", parts: [{ text: "Hello! I am your assistant." }] },
        { role: "user", parts: [{ text: "What can you do?" }] }
      ]
    });
    console.log("✅ Sequence [user, model, user] worked!");
  } catch (e) {
    console.log("❌ Sequence [user, model, user] failed:", e.message);
  }
}

run();
