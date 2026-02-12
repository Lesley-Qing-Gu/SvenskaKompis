
import { GoogleGenAI, Type } from "@google/genai";
import { CoachRequest, SwedishCoachResponse, SpeechEvaluationResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a world-class Swedish language coach and cultural expert (SvenskaKompis). 
Your task is to generate authentic, daily, and practical Swedish dialogues based on user input.

RULES:
1. Always include filler words like 'liksom', 'ju', 'väl', 'precis', 'alltså', 'faktiskt'.
2. Tone: Friendly, encouraging, professional with a touch of Swedish humor ('lagom' jokes).
3. Output MUST be in valid JSON format matching the provided schema.
`;

const EVALUATION_SYSTEM_INSTRUCTION = `
You are a strict but encouraging Swedish phonetics and linguistics expert. 
Your task is to evaluate a user's spoken Swedish audio based on a specific topic.

EVALUATION CRITERIA:
1. Transcript: Transcribe exactly what the user said in Swedish.
2. Content Score: 0-100 based on grammar, vocabulary, and relevance to the topic.
3. Pronunciation Score: 0-100 based on pitch accent (grav/akut), vowel length, and flow.
4. Strengths: List 2-3 specific things the user did well.
5. Improvements: List 2-3 specific areas for correction.
6. Grammar/Pronunciation Notes: Detailed pedagogical explanation.

Output MUST be in valid JSON.
`;

export async function generateSwedishLesson(request: CoachRequest): Promise<SwedishCoachResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const prompt = `
    Scenario: ${request.scenario}
    Level: ${request.level}
    Keywords to include: ${request.keywords}
    Generate a 5-8 round dialogue with vocab and cultural tips.
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

    return JSON.parse(response.text) as SwedishCoachResponse;
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
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
}

export async function evaluateSpeech(audioBase64: string, topic: string): Promise<SpeechEvaluationResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  const prompt = `Topic: ${topic}. Please evaluate my spoken Swedish in the attached audio clip.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Using a stable model for multimodal evaluation
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "audio/webm",
                data: audioBase64
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: EVALUATION_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            contentScore: { type: Type.NUMBER },
            pronunciationScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            grammarNotes: { type: Type.STRING },
            pronunciationNotes: { type: Type.STRING }
          },
          required: ["transcript", "contentScore", "pronunciationScore", "strengths", "improvements", "grammarNotes", "pronunciationNotes"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from evaluation engine");
    return JSON.parse(text) as SpeechEvaluationResponse;
  } catch (error) {
    console.error("Evaluation API Error:", error);
    throw error;
  }
}
