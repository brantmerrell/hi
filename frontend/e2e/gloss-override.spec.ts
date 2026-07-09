import { expect, test } from "@playwright/test";
import { makeSentence, makeWord, mockReaderApi } from "./fixtures";

test("clicking a gloss cell edits the override and PUTs the new note", async ({ page }) => {
  await mockReaderApi(page);

  let putBody: unknown;
  await page.route("**/api/sentences/words/senses/sense-1/note", (route) => {
    putBody = route.request().postDataJSON();
    return route.fulfill({ json: {} });
  });

  await page.goto("/");
  const cell = page.getByTestId("gloss-cell");
  await expect(cell).toHaveText("a unit of language");

  await cell.click();
  const input = page.getByTestId("gloss-cell-input");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("a unit of language");

  await input.fill("custom override");
  await input.press("Enter");

  await expect(page.getByTestId("gloss-cell")).toHaveText("custom override");
  await expect.poll(() => putBody).toEqual({ display_gloss: "custom override" });
});

test("a word without a sense id is not editable", async ({ page }) => {
  await mockReaderApi(page, {
    sentences: [makeSentence({ words: [makeWord({ word_sense_id: null })] })],
  });

  await page.goto("/");
  await page.getByTestId("gloss-cell").click();
  await expect(page.getByTestId("gloss-cell-input")).toHaveCount(0);
});

test("a blank override cell (no note, fallback hidden) is still clickable", async ({ page }) => {
  // Regression test: the Stats/"Words" page renders GlossCell with
  // showFallback={false}, so a word with no note renders as an empty cell.
  // It must still expose a click target the same size as a normal cell.
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { id: "user-1", email: "user@example.com", display_name: null } })
  );
  await page.route("**/api/stats/words**", (route) =>
    route.fulfill({
      json: {
        words: [
          {
            surface_devanagari: "शब्द",
            surface_romanized: "shabd",
            english_gloss: "word",
            word_sense_definition: null,
            note: null,
            word_sense_id: "sense-2",
            play_count: 0,
            word_audio_path: null,
            sentence_word_id: null,
          },
        ],
        summary: { count: 1, mean: 0, min: 0, max: 0 },
      },
    })
  );

  await page.goto("/words");
  const cell = page.getByTestId("gloss-cell");
  await expect(cell).toBeVisible();
  await expect(cell).toHaveText("");

  await cell.click();
  await expect(page.getByTestId("gloss-cell-input")).toBeVisible();
});
