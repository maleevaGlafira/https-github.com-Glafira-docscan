import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Gemini API
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // API route for OCR using Gemini
  app.post("/api/recognize", async (req, res) => {
    try {
      const { images } = req.body; // Array of base64 data URLs

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "No images provided" });
      }

      if (!process.env.GEMINI_API_KEY) {
         return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const parts = images.map((dataUrl: string) => {
        // Handle images that start with "data:image/x;base64,"
        const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
        if (match) {
          return {
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          };
        }
        // Fallback if data is already raw base64 (assume png)
        return {
          inlineData: {
            mimeType: "image/png",
            data: dataUrl,
          },
        };
      });

      const promptPart = {
        text: "Extract all text from the provided images. Correct any grammar or spelling mistakes. Support English, Russian, and Ukrainian fluently. Return ONLY the extracted raw text, without any additional conversational filler, formatting wrappers, or markdown code blocks like ```.",
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [...parts, promptPart] },
        config: {
          temperature: 0.2, // Low temperature for more deterministic OCR results
        },
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to recognize text using Gemini API." });
    }
  });

  // Vite middleware for development or serving static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
