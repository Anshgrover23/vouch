import { expect, test } from "@playwright/test";
import {
  PASSWORD,
  skipOnboarding,
  signupViaApi,
  uniqueEmail,
} from "./helpers";

test.describe("auth and landing", () => {
  test("landing has Get started, How it works, and Sign in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-signup")).toHaveText(/Get started/i);
    await expect(page.getByTestId("landing-how")).toHaveText(/How it works/i);
    await expect(page.getByTestId("nav-login")).toHaveText(/Sign in/i);
    await expect(page.getByTestId("nav-signup")).toHaveText(/Get started/i);
    await expect(page.getByTestId("nav-how")).toBeVisible();
    await expect(page.getByTestId("nav-features")).toBeVisible();
    await expect(page.getByTestId("landing-login")).toHaveCount(0);
    await expect(page.getByText("No login")).toHaveCount(0);

    await page.getByTestId("nav-how").click();
    await expect(page.locator("#how")).toBeInViewport();
    await page.getByTestId("nav-features").click();
    await expect(page.getByTestId("landing-product")).toBeInViewport();
  });

  test("signup shows our field errors, not the browser tooltip", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByTestId("auth-email")).toHaveAttribute("placeholder", "you@example.com");
    await expect(page.getByTestId("auth-password")).not.toHaveAttribute("placeholder");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-name-error")).toHaveText("Enter your name.");
    await expect(page.getByTestId("auth-email-error")).toHaveText("Enter your email.");
    await expect(page.getByTestId("auth-password-error")).toHaveText("Enter your password.");
    await expect(page).toHaveURL(/\/signup/);

    await page.getByTestId("auth-name").fill("Ansh");
    await page.getByTestId("auth-email").fill("ansh");
    await page.getByTestId("auth-password").fill("short");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-name-error")).toHaveCount(0);
    await expect(page.getByTestId("auth-email-error")).toHaveText("That doesn't look like an email.");
    await expect(page.getByTestId("auth-password-error")).toHaveText("Use at least 8 characters.");
    await expect(page).toHaveURL(/\/signup/);
  });

  test("login shows our field errors for a bad email", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("auth-email")).toHaveAttribute("placeholder", "you@example.com");
    await expect(page.getByTestId("auth-password")).not.toHaveAttribute("placeholder");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-email-error")).toHaveText("Enter your email.");
    await expect(page.getByTestId("auth-password-error")).toHaveText("Enter your password.");
    await page.getByTestId("auth-email").fill("ansh");
    await page.getByTestId("auth-password").fill(PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-email-error")).toHaveText("That doesn't look like an email.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/signup creates an account and lands on onboarding", async ({ page }) => {
    await page.goto("/signup");
    await page.getByTestId("auth-name").fill("Ansh");
    await page.getByTestId("auth-email").fill(uniqueEmail("signup"));
    await page.getByTestId("auth-password").fill(PASSWORD);
    await page.getByTestId("auth-submit").click();
    await page.waitForURL(/\/onboarding/);
    await expect(page.getByTestId("onboarding-skip")).toBeVisible();
  });

  test("/login with the wrong password stays and shows an error", async ({ page }) => {
    const email = uniqueEmail("wrongpw");
    await page.goto("/signup");
    await page.getByTestId("auth-name").fill("Ansh");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(PASSWORD);
    await page.getByTestId("auth-submit").click();
    await page.waitForURL(/\/onboarding/);

    await page.request.post("/api/auth/logout");
    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill("not-the-password");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /inbox and /new redirect to /login?next=", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/login\?next=%2Finbox/);
    await page.goto("/new");
    await expect(page).toHaveURL(/\/login\?next=%2Fnew/);
    await page.goto("/groups");
    await expect(page).toHaveURL(/\/login\?next=%2Fgroups/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  });

  test("demo@proofsheet.dev cannot log in without a password hash", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("auth-email").fill("demo@proofsheet.dev");
    await page.getByTestId("auth-password").fill(PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("onboarded login lands on /inbox", async ({ page }) => {
    const email = uniqueEmail("login-ok");
    await signupViaApi(page, { name: "Ansh", email });
    await skipOnboarding(page);
    await page.request.post("/api/auth/logout");
    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(PASSWORD);
    await page.getByTestId("auth-submit").click();
    await page.waitForURL(/\/inbox/);
    await expect(page.getByTestId("inbox-empty")).toBeVisible();
  });

  test("login from a gated page sends you back there", async ({ page }) => {
    const email = uniqueEmail("login-next");
    await signupViaApi(page, { name: "Ansh", email });
    await skipOnboarding(page);
    await page.request.post("/api/auth/logout");
    await page.goto("/groups");
    await expect(page).toHaveURL(/\/login\?next=%2Fgroups/);
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(PASSWORD);
    await page.getByTestId("auth-submit").click();
    await page.waitForURL(/\/groups/);
    await expect(page.getByRole("heading", { name: "Your groups" })).toBeVisible();
  });
});
