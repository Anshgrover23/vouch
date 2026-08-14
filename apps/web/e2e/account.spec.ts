import { expect, test } from "@playwright/test";
import { PASSWORD, skipOnboarding, signupViaApi, uniqueEmail } from "./helpers";

test.describe("account and landing product", () => {
  test("landing markets groups and signed-in nav is Account, not Log out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-product")).toBeVisible();
    await expect(page.getByTestId("product-groups")).toBeVisible();
    await expect(page.getByTestId("product-type")).toBeVisible();
    await expect(page.getByTestId("product-settle")).toBeVisible();

    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("nav") });
    await skipOnboarding(page);
    await page.goto("/");
    await expect(page.getByTestId("nav-account")).toBeVisible();
    await expect(page.getByTestId("nav-account")).toHaveText("Account");
    await expect(page.getByTestId("nav-groups")).toBeVisible();
    await expect(page.locator("header").getByRole("button", { name: "Log out" })).toHaveCount(0);
    await expect(page.getByTestId("landing-new")).toBeVisible();
    await expect(page.getByTestId("landing-splits")).toBeVisible();
    await expect(page.getByTestId("landing-signup")).toHaveCount(0);
    await expect(page.getByTestId("landing-login")).toHaveCount(0);
  });

  test("phone nav keeps New receipt and opens Splits Groups Account from Menu", async ({ page }) => {
    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("nav-phone") });
    await skipOnboarding(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "New receipt" }).first()).toBeVisible();
    await expect(page.getByTestId("nav-menu")).toBeVisible();
    await expect(page.getByTestId("nav-groups")).toBeHidden();
    await page.getByTestId("nav-menu").click();
    await expect(page.getByTestId("nav-splits")).toBeVisible();
    await expect(page.getByTestId("nav-groups")).toBeVisible();
    await expect(page.getByTestId("nav-account")).toHaveText("Account");
    await page.getByTestId("nav-groups").click();
    await page.waitForURL(/\/groups/);
  });

  test("/account saves name, changes password, and log out lands on /", async ({ page }) => {
    const email = uniqueEmail("account");
    await signupViaApi(page, { name: "Ansh", email });
    await skipOnboarding(page);
    await page.goto("/account");
    await expect(page.getByTestId("account-you")).toContainText("Ansh");
    await page.getByTestId("account-name").fill("Riley");
    await page.getByTestId("account-name-save").click();
    await expect(page.getByTestId("account-you")).toContainText("Riley");

    await page.getByTestId("account-password-current").fill(PASSWORD);
    await page.getByTestId("account-password-next").fill("password2");
    await page.getByTestId("account-password-save").click();
    await expect(page.getByText("Password updated.")).toBeVisible();

    await page.getByTestId("account-logout").getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("/");
    await expect(page.getByTestId("landing-signup")).toBeVisible();

    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill("password2");
    await page.getByTestId("auth-submit").click();
    await page.waitForURL(/\/(inbox|new|groups)/);
  });
});
