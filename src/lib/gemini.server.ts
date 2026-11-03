/**
 * Google Cloud Gemini Integration
 * Uses server-side proxy when invoked in browser to protect API secrets,
 * and direct GoogleGenAI on Node.js server.
 */

export async function callGemini(prompt: string, systemInstruction?: string): Promise<string | null> {
  // If running in browser, proxy through backend endpoint /api/gemini
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemInstruction }),
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      return data?.text ?? null;
    } catch {
      return null;
    }
  }

  // If running on server side (Node.js)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });
    return response.text ?? null;
  } catch (e) {
    console.error("[Google Cloud Gemini Server] Error:", e);
    return null;
  }
}

