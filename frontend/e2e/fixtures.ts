import type { Page } from "@playwright/test";

export const story = {
  id: "story-1",
  position: 0,
  title_hi: "कहानी",
  title_en: "The Story",
  author: "Test Author",
};

export function makeWord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "word-1",
    position: 0,
    surface_devanagari: "शब्द",
    surface_romanized: "shabd",
    english_gloss: "word",
    word_sense_definition: "a unit of language",
    word_sense_id: "sense-1",
    note: null,
    word_audio_path: null,
    ...overrides,
  };
}

export function makeSentence(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sentence-1",
    story_id: story.id,
    sequence_num: 0,
    devanagari: "यह एक वाक्य है।",
    romanized: "yah ek vaakya hai.",
    english: "This is a sentence.",
    audio_path: null,
    words: [makeWord()],
    ...overrides,
  };
}

/**
 * Stubs the read-only API surface the Reader page hits on load, so tests run
 * without a backend/database. Pass `sentences` to control the word list seen
 * by both the sentence-list and per-sentence detail endpoints.
 */
export async function mockReaderApi(
  page: Page,
  options: { loggedIn?: boolean; sentences?: ReturnType<typeof makeSentence>[] } = {}
) {
  const sentences = options.sentences ?? [makeSentence()];

  await page.route("**/api/auth/me", (route) => {
    if (options.loggedIn) {
      return route.fulfill({
        json: { id: "user-1", email: "user@example.com", display_name: null },
      });
    }
    return route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
  });

  await page.route("**/api/bookmarks", (route) => {
    if (route.request().method() === "PUT") return route.fulfill({ json: {} });
    return route.fulfill({ status: 404, json: null });
  });

  await page.route("**/api/stories", (route) => route.fulfill({ json: [story] }));

  await page.route(`**/api/stories/${story.id}/sentences**`, (route) =>
    route.fulfill({ json: sentences })
  );

  for (const sentence of sentences) {
    await page.route(`**/api/sentences/${sentence.id}`, (route) =>
      route.fulfill({ json: sentence })
    );
  }

  await page.route("**/api/sentences/words/senses/*/note", (route) =>
    route.fulfill({ json: {} })
  );

  await page.route("**/api/sentences/words/*/played", (route) => route.fulfill({ json: {} }));
}
