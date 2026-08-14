import { expect, test } from "@playwright/test";
import {
  createGroceryReceipt,
  skipOnboarding,
  signupViaApi,
  uniqueEmail,
} from "./helpers";

test.describe("inbox splits", () => {
  test("empty inbox points you at a new receipt", async ({ page }) => {
    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("inbox-empty") });
    await skipOnboarding(page);
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Your splits" })).toBeVisible();
    await expect(page.getByTestId("inbox-empty")).toBeVisible();
    await page.getByTestId("inbox-new").click();
    await page.waitForURL(/\/new/);
  });

  test("a receipt shows in Splits and opens review", async ({ page }) => {
    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("inbox-list") });
    await skipOnboarding(page);
    await createGroceryReceipt(page);
    await page.goto("/groups");
    await page.getByTestId("nav-splits").click();
    await page.waitForURL(/\/inbox/);
    await expect(page.getByTestId("inbox-list")).toContainText(/Hillcrest/i);
    await page.getByTestId("inbox-card").click();
    await page.waitForURL(/\/review\//);
    await expect(page.getByTestId("identity-bar")).toBeVisible();
  });
});
