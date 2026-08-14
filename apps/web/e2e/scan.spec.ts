import { expect, test } from "@playwright/test";
import {
  SAMPLE_PAYMENT,
  SAMPLE_RECEIPT,
  becomeOnboarded,
  dismissInvite,
  signupViaApi,
  uniqueEmail,
} from "./helpers";

test.describe("scan a receipt", () => {
  test.beforeEach(async ({ page }) => {
    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("scan") });
    await becomeOnboarded(page);
  });

  test("dropping the sample photo lands on the Hillcrest review", async ({ page }) => {
    await page.goto("/new");
    await expect(page.getByTestId("new-drop")).toBeVisible();
    await page.getByTestId("new-file").setInputFiles(SAMPLE_RECEIPT);
    await page.getByTestId("new-chip-grocery-receipt").click();
    await page.getByTestId("new-read").click();
    await page.waitForURL(/\/review\//, { timeout: 45_000 });
    await dismissInvite(page);
    await expect(page.getByTestId("line-value-merchant")).toBeVisible();
    await expect(page.getByTestId("line-value-merchant")).toHaveValue(/Hillcrest/i);
  });

  test("Venmo screenshot fixture lands on the payment review", async ({ page }) => {
    await page.goto("/new");
    await page.getByTestId("new-file").setInputFiles(SAMPLE_PAYMENT);
    await page.getByTestId("new-chip-venmo-screenshot").click();
    await page.getByTestId("new-read").click();
    await page.waitForURL(/\/review\//, { timeout: 45_000 });
    await dismissInvite(page);
    await expect(page.getByTestId("line-value-recipient")).toHaveValue(/Jordan Hale/i);
  });
});
