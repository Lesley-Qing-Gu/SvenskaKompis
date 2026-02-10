
import { GoogleGenAI, Type } from "@google/genai";
import { CoachRequest, SwedishCoachResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a world-class Swedish language coach and cultural expert (SvenskaKompis). 
Your task is to generate authentic, daily, and practical Swedish dialogues based on user input.

RULES:
1. Always include filler words like 'liksom', 'ju', 'väl', 'precis', 'alltså', 'faktiskt'.
2. Tone: Friendly, encouraging, professional with a touch of Swedish humor ('lagom' jokes).
3. Output MUST be in valid JSON format matching the provided schema.
4. For 'SFI C/D', use clear grammar and common words.
5. For 'Professional', use formal yet modern corporate Swedish.
6. For 'Slang/Casual', use high-frequency street slang and contractions (e.g., 'ska' instead of 'skall', 'dom' instead of 'de/dem').
7. Cultural tip must be hyper-specific to Sweden (e.g., Fika etiquette, Systembolaget hours, laundry room drama 'tvättstuga').

JSON Schema:
{
  "vocabulary": [{"term": "string", "translation": "string", "info": "string"}],
  "dialogue": [{"role": "Role A", "swedish": "string", "chinese": "string"}],
  "culturalTip": "string",
  "pronunciation": [{"term": "string", "explanation": "string"}]
}
`;

export async function generateSwedishLesson(request: CoachRequest): Promise<SwedishCoachResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  const prompt = `
    Scenario: ${request.scenario}
    Level: ${request.level}
    Keywords to include: ${request.keywords}
    
    Generate a 5-8 round dialogue. Ensure the keywords are used naturally.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  translation: { type: Type.STRING },
                  info: { type: Type.STRING }
                },
                required: ["term", "translation", "info"]
              }
            },
            dialogue: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  swedish: { type: Type.STRING },
                  chinese: { type: Type.STRING }
                },
                required: ["role", "swedish", "chinese"]
              }
            },
            culturalTip: { type: Type.STRING },
            pronunciation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["term", "explanation"]
              }
            }
          },
          required: ["vocabulary", "dialogue", "culturalTip", "pronunciation"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as SwedishCoachResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.warn("TTS API returned no audio data. Check safety filters or API limits.");
    }
    return base64Audio;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return undefined;
  }
}
