import { expect, test } from "@playwright/test";
import { makeSentence, mockReaderApi, story } from "./fixtures";

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
