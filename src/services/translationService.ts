import OpenAI from 'openai';
import { redis } from '../redis';
import { logger } from '../logger';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// In-memory LRU cache for ultra-fast repeated lookup
const localTranslationCache = new Map<string, string>();
const MAX_LOCAL_CACHE = 5000;

/**
 * Translates a single text string into the target language.
 * Uses a two-tier cache (In-Memory + Redis) before calling OpenAI.
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  if (!text || !text.trim() || !targetLanguage || targetLanguage === 'en' || targetLanguage === 'original') {
    return text;
  }

  const cleanText = text.trim();
  const cacheKey = `trans:${targetLanguage}:${Buffer.from(cleanText).toString('base64').substring(0, 64)}`;

  // 1. Check local in-memory cache
  if (localTranslationCache.has(cacheKey)) {
    return localTranslationCache.get(cacheKey)!;
  }

  // 2. Check Redis cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      localTranslationCache.set(cacheKey, cached);
      return cached;
    }
  } catch (err) {
    logger.warn('Redis translation cache get error', err);
  }

  // 3. Perform single-pass translation via OpenAI
  if (!openai) {
    return text;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a real-time meeting translator. Translate the given text into language code '${targetLanguage}'. Return ONLY the translated text with no conversational filler, quotes, or markdown.`
        },
        {
          role: 'user',
          content: cleanText
        }
      ],
      temperature: 0.1,
      max_tokens: 256,
    });

    const translated = response.choices[0]?.message?.content?.trim() || cleanText;

    // Cache result in Redis for 24 hours
    await redis.set(cacheKey, translated, 'EX', 86400).catch(() => {});
    
    // Cache in local memory
    if (localTranslationCache.size > MAX_LOCAL_CACHE) {
      localTranslationCache.clear();
    }
    localTranslationCache.set(cacheKey, translated);

    return translated;
  } catch (err: any) {
    logger.error(`Translation failed for target ${targetLanguage}:`, err.message);
    return text;
  }
}

/**
 * Translates text into multiple target languages in parallel.
 */
export async function translateToMultipleLanguages(
  text: string,
  targetLanguages: string[]
): Promise<Record<string, string>> {
  const translations: Record<string, string> = {};
  if (!text || !targetLanguages || targetLanguages.length === 0) return translations;

  const uniqueLangs = Array.from(new Set(targetLanguages)).filter(
    l => l && l !== 'en' && l !== 'original' && l.trim().length > 0
  );

  if (uniqueLangs.length === 0) return translations;

  await Promise.all(
    uniqueLangs.map(async (lang) => {
      try {
        const trans = await translateText(text, lang);
        if (trans && trans !== text) {
          translations[lang] = trans;
        }
      } catch (e) {
        logger.warn(`Batch translation error for ${lang}:`, e);
      }
    })
  );

  return translations;
}
