import { expect, test } from "@playwright/test";
import { signupViaUi, uniqueEmail } from "./helpers";

test.describe("onboarding", () => {
  test("Skip goes to /new", async ({ page }) => {
    await signupViaUi(page, { name: "Ansh", email: uniqueEmail("skip") });
    await page.getByTestId("onboarding-skip").click();
    await page.waitForURL(/\/new/);
  });

  test("Group expense with a name goes to /new", async ({ page }) => {
    await signupViaUi(page, { name: "Ansh", email: uniqueEmail("group") });
    await page.getByTestId("onboarding-group").click();
    await page.getByTestId("onboarding-group-name").fill("412 Oak");
    await page.getByTestId("onboarding-continue").click();
    await page.waitForURL(/\/new/);
  });

  test("One-off goes to /new", async ({ page }) => {
    await signupViaUi(page, { name: "Ansh", email: uniqueEmail("oneoff") });
    await page.getByTestId("onboarding-one-off").click();
    await page.waitForURL(/\/new/);
  });
});
