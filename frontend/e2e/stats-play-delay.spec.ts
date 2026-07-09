import { expect, test } from "@playwright/test";
import { makeStatWord } from "./fixtures";

// https://github.com/brantmerrell/hi/issues/9
// Clicking a word's play button must not re-sort/refetch the list
// immediately, since a played word (e.g. the top row when sorting by
// review count) can otherwise vanish from view before the user hears it.
// The fix delays the refetch by 2s; this test asserts that timing using
// Playwright's virtual clock rather than a real 2-second sleep.
test("clicking play waits ~2s before refetching and re-sorting the word list", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { id: "user-1", email: "user@example.com", display_name: null } })
  );

  let statsCallCount = 0;
  await page.route("**/api/stats/words**", (route) => {
    statsCallCount += 1;
    const playCount = statsCallCount === 1 ? 3 : 4;
    return route.fulfill({
      json: {
        words: [makeStatWord({ play_count: playCount })],
        summary: { count: 1, mean: playCount, min: playCount, max: playCount },
      },
    });
  });

  await page.route("**/api/sentences/words/sw-1/played", (route) => route.fulfill({ json: {} }));

  const playCountCell = page.getByRole("cell", { name: "3", exact: true });

  await page.clock.install();
  await page.goto("/words");
  await expect(playCountCell).toBeVisible();
  expect(statsCallCount).toBe(1);

  await page.getByTitle("Play audio").click();

  // Let the click handler's own promise chain (audio.play + the POST to
  // /played) settle — this is real microtask work, not a fake-timer delay.
  await page.waitForTimeout(100);
  expect(statsCallCount).toBe(1);

  // Just short of 2s: still showing the pre-play data.
  await page.clock.fastForward(1800);
  expect(statsCallCount).toBe(1);
  await expect(playCountCell).toBeVisible();

  // Past the 2s mark: the refetch has fired and the list updates.
  await page.clock.fastForward(400);
  await expect.poll(() => statsCallCount).toBe(2);
  await expect(page.getByRole("cell", { name: "4", exact: true })).toBeVisible();
});
