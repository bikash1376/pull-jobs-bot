import { createMistral } from '@ai-sdk/mistral';

const mistral = createMistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

/** High-performance model on Mistral (mistral-large-latest). */
export const chatModel = mistral('mistral-large-latest');
