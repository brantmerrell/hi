import { expect, test } from "@playwright/test";
import { makeSentence, mockReaderApi, story } from "./fixtures";

test("reader shows a sentence and navigates forward", async ({ page }) => {
  const sentences = [
    makeSentence({ id: "s1", sequence_num: 0, english: "First sentence." }),
    makeSentence({ id: "s2", sequence_num: 1, english: "Second sentence." }),
  ];
  await mockReaderApi(page, { sentences });

  await page.goto("/");
  await expect(page).toHaveURL(`/${story.position}/1`);
  await expect(page.getByText("First sentence.")).toBeVisible();

  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page).toHaveURL(`/${story.position}/2`);
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
