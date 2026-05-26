"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const ai = new genai_1.GoogleGenAI({ apiKey: "test" });
async function run() {
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "test",
        config: { systemInstruction: "test" }
    });
    console.log(response.text);
    console.log(response.candidates?.[0].content?.parts);
}
//# sourceMappingURL=test.js.map