
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

// FIX: Initialize GoogleGenAI by passing process.env.API_KEY directly as per the guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) {
    return "";
  }
  
  try {
    const prompt = `Generate a short, engaging title (maximum 10 words) for the following post body. Do not use quotation marks in the title:\n\n---\n${body}\n---`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const title = response.text.trim().replace(/["']/g, ''); // Remove quotes
    return title;

  } catch (error) {
    console.error("Error generating title with Gemini:", error);
    return "";
  }
};
