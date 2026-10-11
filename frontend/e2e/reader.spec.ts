import { expect, test } from "@playwright/test";
import { makeSentence, makeWord, mockReaderApi, story } from "./fixtures";

test("reader shows a sentence and navigates forward", async ({ page }) => {
  const sentences = [
    makeSentence({ id: "s1", sequence_num: 0, english: "First sentence." }),
    makeSentence({ id: "s2", sequence_num: 1, english: "Second sentence." }),
  ];
  await mockReaderApi(page, { sentences });

  await page.goto("/");
  await expect(page).toHaveURL(`/${story.author_slug}/${story.position}/1`);
  await expect(page.getByText("First sentence.")).toBeVisible();

  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page).toHaveURL(`/${story.author_slug}/${story.position}/2`);
  await expect(page.getByText("Second sentence.")).toBeVisible();
});

test("word-by-word toggle switches from the sentence view to the gloss table", async ({ page }) => {
  await mockReaderApi(page);

  await page.goto("/");
  await expect(page.getByTestId("gloss-cell")).toHaveText("a unit of language");
  await expect(page.locator("table")).toHaveCount(0);

  await page.getByRole("button", { name: "Show word-by-word" }).click();
  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByText("Gloss")).toBeVisible();
  await expect(page.getByTestId("gloss-cell")).toHaveText("a unit of language");
});

test("legacy /:storyNum/:sentenceNum URLs redirect to the author-scoped form", async ({ page }) => {
  await mockReaderApi(page);

  await page.goto(`/${story.position}/1`);
  await expect(page).toHaveURL(`/${story.author_slug}/${story.position}/1`);
});

test("sidebar lists authors and expands to their stories", async ({ page }) => {
  await mockReaderApi(page);
  const other = { ...story, id: "story-2", position: 0, title_hi: "दूसरी", title_en: "Other", author: "Other Author", author_slug: "other-author" };
  await page.route("**/api/stories", (route) => route.fulfill({ json: [story, other] }));

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Authors and stories" });
  await expect(nav.getByRole("link", { name: /The Story/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Other/ })).toHaveCount(0);

  await nav.getByRole("button", { name: /Other Author/ }).click();
  await nav.getByRole("link", { name: /Other/ }).click();
  await expect(page).toHaveURL(/\/other-author\/0/);
});

test("the word being spoken is highlighted as the sentence audio plays", async ({ page }) => {
  const words = [
    makeWord({ id: "w1", position: 0, surface_devanagari: "यह", start_ms: 0 }),
    makeWord({ id: "w2", position: 1, surface_devanagari: "वाक्य", start_ms: 800 }),
  ];
  await mockReaderApi(page, { sentences: [makeSentence({ audio_path: "s.mp3", words })] });
  await page.route("**/audio/**", (route) => route.fulfill({ body: "", contentType: "audio/mpeg" }));

  await page.goto("/");
  const first = page.locator('[data-active]', { hasText: "यह" });
  const second = page.locator('[data-active]', { hasText: "वाक्य" });
  await expect(first).toHaveAttribute("data-active", "false");

  const seek = (seconds: number) =>
    page.locator("audio").evaluate((el: HTMLAudioElement, t) => {
      Object.defineProperty(el, "currentTime", { value: t, configurable: true });
      el.dispatchEvent(new Event("timeupdate"));
    }, seconds);

  await seek(0.1);
  await expect(first).toHaveAttribute("data-active", "true");
  await expect(second).toHaveAttribute("data-active", "false");

  await seek(0.9);
  await expect(first).toHaveAttribute("data-active", "false");
  await expect(second).toHaveAttribute("data-active", "true");
});
