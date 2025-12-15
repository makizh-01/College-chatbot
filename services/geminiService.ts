import { GoogleGenAI, Type } from "@google/genai";
import { Message, Language } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is not defined in process.env");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

const SYSTEM_INSTRUCTION = `
You are 'SankaraConnect', an intelligent and helpful AI assistant for Sankara College (sankara.ac.in).

Your goals:
1. Provide accurate, real-time information about Sankara College (Arts, Science, Management, etc.) by ALWAYS using the 'googleSearch' tool to verify facts from their official website.
2. Reply in the language requested by the user context (Tamil or English).
3. Be concise, polite, and student-friendly.
4. If the information is not found on the website, state that clearly and suggest contacting the college administration.
5. Do not make up facts. Use the search tool grounding.

Key Search Strategy:
- When searching, append "site:sankara.ac.in" or "Sankara College Coimbatore" to your queries to ensure relevance.

Output Structure:
1. The main answer in the requested language.
2. If Tamil is requested, the main answer MUST follow this format: "Tamil Script ||| Tanglish Transliteration".
3. AFTER the main answer (and transliteration if applicable), you MUST output the delimiter "///".
4. After the delimiter, provide 3 short, relevant follow-up questions/suggestions for the user on separate lines.

Example Output (English):
Sankara College offers various undergraduate and postgraduate programs.
///
What are the admission fees?
Does the college provide hostel facilities?
Tell me about placement opportunities.

Example Output (Tamil):
சங்கரா கல்லூரியில் பல்வேறு இளங்கலை மற்றும் முதுகலை படிப்புகள் உள்ளன. ||| Sankara kalluriyil palveru ilangalai matrum muthugalai padippugal ullana.
///
சேர்க்கை கட்டணம் என்ன?
விடுதி வசதிகள் உள்ளதா?
வேலைவாய்ப்பு பற்றி சொல்லுங்கள்.
`;

export const sendMessageToGemini = async (
  history: Message[],
  userMessage: string,
  language: Language
): Promise<{ text: string; sources: string[]; speechText?: string; suggestions: string[] }> => {
  try {
    const model = "gemini-3-pro-preview"; 

    // Explicitly instruction the model to use the selected language and format
    const languageInstruction = language === Language.TAMIL 
      ? " (Please answer in Tamil. Output format: Tamil Script ||| Tanglish Transliteration. Then add suggestions after ///)" 
      : " (Please answer in English. Add suggestions after ///)";

    const response = await ai.models.generateContent({
      model: model,
      contents: userMessage + languageInstruction,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });

    const fullResponse = response.text || (language === Language.TAMIL 
      ? "மன்னிக்கவும், என்னால் தகவலைப் பெற முடியவில்லை. ||| Mannikkavum, ennal thagavalai pera mudiyavillai." 
      : "I'm sorry, I couldn't retrieve that information.");
    
    // 1. Separate Main Content and Suggestions
    let contentPart = fullResponse;
    let suggestions: string[] = [];

    if (fullResponse.includes("///")) {
      const parts = fullResponse.split("///");
      contentPart = parts[0].trim();
      const suggestionsRaw = parts[1].trim();
      // Split by newline and filter empty strings
      suggestions = suggestionsRaw.split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .slice(0, 3); // Limit to 3
    }

    // 2. Separate Display Text and Speech Text (for Tamil/Tanglish)
    let displayText = contentPart;
    let speechText = contentPart;

    if (contentPart.includes("|||")) {
      const parts = contentPart.split("|||");
      displayText = parts[0].trim();
      speechText = parts[1].trim();
    }

    // Extract grounding chunks for sources
    const sources: string[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      });
    }

    // Deduplicate sources
    const uniqueSources = Array.from(new Set(sources));

    return { text: displayText, speechText: speechText, sources: uniqueSources, suggestions: suggestions };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { 
      text: language === Language.TAMIL 
        ? "மன்னிக்கவும், சேவையகத்துடன் இணைப்பதில் சிக்கல் உள்ளது. பின்னர் முயற்சிக்கவும்." 
        : "I apologize, but I'm having trouble connecting to the server right now. Please try again later.",
      speechText: language === Language.TAMIL
        ? "Mannikkavum, sevaiyagathudan inaippathil sikkal ulladhu. Pinnar muyarchikkavum."
        : undefined,
      sources: [],
      suggestions: []
    };
  }
};