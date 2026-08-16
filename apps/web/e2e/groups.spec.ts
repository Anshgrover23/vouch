import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  createGroceryReceipt,
  createGroup,
  dismissInvite,
  signupViaApi,
  skipOnboarding,
  typeManualReceipt,
  uniqueEmail,
} from "./helpers";

test.describe("groups hub and typed receipt", () => {
  test.beforeEach(async ({ page }) => {
    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("groups") });
    await skipOnboarding(page);
  });

  test("creating the same group name twice keeps a single row", async ({ page }) => {
    await page.goto("/groups");
    await expect(page.getByTestId("group-name")).toBeVisible();
    await page.getByTestId("group-name").fill("DS-168");
    await page.getByTestId("groups-create").click();
    await page.waitForURL(/\/groups\/.+/);
    const firstId = page.url();
    await page.goto("/groups");
    await page.getByTestId("group-name").fill("DS-168");
    await page.getByTestId("groups-create").click();
    await page.waitForURL(/\/groups\/.+/);
    expect(page.url()).toBe(firstId);
    await page.goto("/groups");
    await expect(page.getByTestId("groups-list").locator("li")).toHaveCount(1);
    await expect(page.getByTestId("groups-list")).toContainText("DS-168");
  });

  test("skip onboarding still lets you create a group later", async ({ page }) => {
    await page.goto("/new");
    await page.getByTestId("nav-groups").click();
    await page.waitForURL(/\/groups/);
    await expect(page.getByText("No groups yet.")).toBeVisible();
    await page.getByTestId("group-name").fill("412 Oak");
    await page.getByTestId("groups-create").click();
    await expect(page.getByRole("heading", { name: "412 Oak" })).toBeVisible();
    await expect(page.getByTestId("group-back")).toBeVisible();
    await expect(page.getByTestId("group-new-receipt")).toBeVisible();
    await expect(page.getByRole("link", { name: "New receipt" })).toHaveCount(1);
    await expect(page.getByTestId("nav-account")).toHaveText("Account");
    await page.getByTestId("group-tab-settings").click();
    await page.getByTestId("group-add-member").fill("Goru");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Goru")).toBeVisible();
    await expect(page.getByText("waiting")).toBeVisible();
    await page.getByTestId("group-back").click();
    await page.waitForURL(/\/groups$/);
    await expect(page.getByTestId("groups-list")).toContainText("412 Oak");
  });

  test("typed receipt shows field errors instead of the browser tooltip", async ({ page }) => {
    await page.goto("/new");
    await page.getByTestId("new-manual").click();
    await page.getByTestId("manual-submit").click();
    await expect(page.getByTestId("manual-merchant-error")).toHaveText("Name the merchant.");
    await expect(page.getByTestId("manual-total-error")).toHaveText("Enter a receipt total like 12.50.");
    await expect(page.getByTestId("manual-date-error")).toHaveCount(0);
    await expect(page.getByTestId("manual-merchant")).toHaveAttribute("aria-required", "true");
    await expect(page.getByTestId("manual-total")).toHaveAttribute("aria-required", "true");
    await expect(page.getByTestId("manual-date")).not.toHaveAttribute("aria-required");
    await expect(page).toHaveURL(/\/new/);
    await page.getByTestId("manual-item-name-0").fill("Coffee");
    await page.getByTestId("manual-submit").click();
    await expect(page.getByTestId("manual-item-price-0-error")).toHaveText("Enter a price like 4.50 for line 1.");
  });

  test("typed receipt lands on review with merchant and a line", async ({ page }) => {
    await page.goto("/new");
    await page.getByTestId("new-manual").click();
    await page.getByTestId("manual-merchant").fill("Corner Deli");
    await page.getByTestId("manual-date").fill("14 Aug 2026");
    await page.getByTestId("manual-total").fill("12.50");
    await page.getByTestId("manual-item-name-0").fill("Coffee");
    await page.getByTestId("manual-item-price-0").fill("4.50");
    await page.getByTestId("manual-submit").click();
    await page.waitForURL(/\/review\//);
    await dismissInvite(page);
    await expect(page.getByTestId("line-value-merchant")).toHaveValue("Corner Deli");
    await expect(page.getByTestId("line-label-item_1")).toHaveValue("Coffee");
    await expect(page.getByTestId("line-amount-item_1")).toHaveValue("4.50");
    await expect(page.getByText("Typed receipt")).toBeVisible();
  });
});

test.describe("group chrome leftover flows", () => {
  test.beforeEach(async ({ page }) => {
    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("group-flow") });
    await skipOnboarding(page);
  });

  test("share, notes, star, CSV, and phone keeps back", async ({ page }) => {
    const group = await createGroup(page, "412 Oak");
    await createGroceryReceipt(page, group.id);
    await page.goto(`/groups/${group.id}`);
    await expect(page.getByTestId("group-back")).toBeVisible();

    await page.getByTestId("group-share").click();
    await expect(page.getByTestId("group-share")).toHaveText(/Copied/i);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/groups/${group.id}`);

    await page.getByTestId("group-tab-settings").click();
    await page.getByTestId("settings-notes").fill("Wifi: oak-guest");
    const saved = page.waitForResponse(
      (res) => res.url().includes(`/api/groups/${group.id}`) && res.request().method() === "PATCH" && res.ok(),
    );
    await page.getByTestId("settings-save").click();
    await saved;
    await page.reload();
    await expect(page.getByTestId("settings-notes")).toHaveValue("Wifi: oak-guest");
    await expect(page.getByRole("button", { name: /Star/i })).toHaveCount(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("group-export").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const body = readFileSync(filePath!, "utf8");
    expect(body).toMatch(/Merchant/);
    expect(body).toMatch(/Hillcrest/i);
    expect(body).toMatch(/OAT MILK/);
    expect(body).toMatch(/EGGS 12CT/);
    expect(body).toMatch(/Item,Amount,Paid by,Claimed by/);

    await page.getByTestId("group-back").click();
    await page.waitForURL(/\/groups$/);
    await page.getByRole("button", { name: "Star 412 Oak" }).click();
    await expect(page.getByRole("button", { name: "Unstar 412 Oak" })).toBeVisible();

    await page.goto(`/groups/${group.id}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("group-back")).toBeVisible();
    await expect(page.getByTestId("group-back")).toHaveText("← Groups");
    await expect(page.getByTestId("nav-account")).toBeHidden();
    await expect(page.getByTestId("group-tab-receipts")).toBeVisible();
    await expect(page.getByRole("link", { name: "New receipt" })).toHaveCount(1);
    const backBox = await page.getByTestId("group-back").boundingBox();
    const newBox = await page.getByTestId("group-new-receipt").boundingBox();
    expect(backBox).toBeTruthy();
    expect(newBox).toBeTruthy();
    expect(backBox!.x + backBox!.width).toBeLessThanOrEqual(newBox!.x + 1);
    await page.getByTestId("group-tab-settings").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("group-tab-settings")).toBeInViewport();
    await page.getByTestId("group-tab-balances").click();
    await page.waitForURL(/\/balances$/);
  });

  test("New receipt from a group stays attached to that group", async ({ page }) => {
    const group = await createGroup(page, "412 Oak");
    await page.goto(`/groups/${group.id}`);
    await page.getByTestId("group-new-receipt").click();
    await page.waitForURL(new RegExp(`/new\\?group=${group.id}`));
    await expect(page.getByTestId("new-group-context")).toBeVisible();
    await expect(page.getByTestId("new-back-group")).toContainText(/412 Oak/i);
    await typeManualReceipt(page, {
      merchant: "Corner Deli",
      date: "14 Aug 2026",
      total: "12.50",
      item: "Coffee",
      price: "4.50",
    });
    await dismissInvite(page);
    await page.goto(`/groups/${group.id}`);
    await expect(page.getByTestId("receipts-list")).toContainText(/Corner Deli/i);
  });
});
