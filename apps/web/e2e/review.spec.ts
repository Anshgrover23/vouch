/**
 * Playwright e2e for Vouch. Requires Postgres (`pnpm local` or Docker on :5432)
 * and a Next server on http://localhost:3000. Extract is forced to the Hillcrest
 * fixture via PROOFSHEET_FIXTURE=1 on the Playwright webServer env.
 */
import { expect, test } from "@playwright/test";
import {
  addGroupMember,
  createGroceryReceipt,
  createGroup,
  dismissInvite,
  openReview,
  signupViaApi,
  becomeOnboarded,
  uniqueEmail,
} from "./helpers";

test.describe("review canvas (Hillcrest fixture)", () => {
  test.beforeEach(async ({ page }) => {
    await signupViaApi(page, { name: "Ansh", email: uniqueEmail("review") });
    await becomeOnboarded(page);
  });

  test("merchant and date sit above items; owner can edit them", async ({ page }) => {
    const { id, shareToken } = await createGroceryReceipt(page);
    await openReview(page, id);
    const order = await page.getByTestId("review-lines").locator(":scope > li").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid") ?? ""),
    );
    const merchantAt = order.indexOf("line-merchant");
    const dateAt = order.indexOf("line-date");
    const firstItem = order.findIndex((key) => key.startsWith("line-item_"));
    const lastItem = order.reduce((last, key, i) => (key.startsWith("line-item_") ? i : last), -1);
    const totalAt = order.indexOf("line-total");
    expect(merchantAt).toBeGreaterThanOrEqual(0);
    expect(dateAt).toBeGreaterThanOrEqual(0);
    expect(firstItem).toBeGreaterThan(dateAt);
    expect(merchantAt).toBeLessThan(firstItem);
    expect(dateAt).toBeLessThan(firstItem);
    expect(totalAt).toBeGreaterThan(lastItem);
    await expect(page.getByTestId("line-value-merchant")).toHaveValue(/Hillcrest/i);
    await page.getByTestId("line-value-merchant").fill("Hillcrest Foods");
    await page.getByTestId("line-value-merchant").blur();
    await expect(page.getByTestId("line-value-merchant")).toHaveValue("Hillcrest Foods");
    await expect(page.getByTestId("line-amount-merchant")).toHaveCount(0);
    await expect(page.getByTestId("line-amount-date")).toHaveCount(0);
    const itemAmt = page.getByTestId("line-amount-item_3");
    const totalAmt = page.getByTestId("line-amount-total");
    await itemAmt.scrollIntoViewIfNeeded();
    await totalAmt.scrollIntoViewIfNeeded();
    const itemBox = await itemAmt.boundingBox();
    const totalBox = await totalAmt.boundingBox();
    expect(itemBox).toBeTruthy();
    expect(totalBox).toBeTruthy();
    expect(Math.abs(itemBox!.x + itemBox!.width - (totalBox!.x + totalBox!.width))).toBeLessThan(3);
    const dollarGap = await page.getByTestId("line-item_3").evaluate((row) => {
      const input = row.querySelector('[data-testid="line-amount-item_3"]');
      const mark = input?.previousElementSibling;
      if (!input || !mark) return 99;
      return input.getBoundingClientRect().left - mark.getBoundingClientRect().right;
    });
    expect(dollarGap).toBeLessThan(3);
    await expect(page.getByTestId("line-value-total")).toHaveText("$84.20");
    await expect(page.getByTestId("split-copy")).toHaveText("Copy Receipt", {
      useInnerText: true,
      ignoreCase: true,
    });
    await page.goto(`/s/${shareToken}`);
    await expect(page.getByTestId("line-value-merchant")).toHaveText(/Hillcrest Foods/i);
    await expect(page.getByTestId("line-label-item_3")).toHaveCount(0);
  });

  test("signed-in owner can claim without a That's me step", async ({ page }) => {
    const { id } = await createGroceryReceipt(page);
    await openReview(page, id);
    await expect(page.getByTestId("identity-bar")).toHaveCount(0);
    await expect(page.getByTestId("paid-by-bar")).toBeVisible();
    await page.getByTestId("owe-item_3").click();
    await expect(page.getByTestId("person-total-ansh")).toHaveText("$5.29");
  });

  test("Ansh claiming Oat milk is $5.29, not half", async ({ page }) => {
    const { id } = await createGroceryReceipt(page);
    await openReview(page, id);
    await page.getByTestId("owe-item_3").click();
    await expect(page.getByTestId("person-ansh")).toBeVisible();
    await expect(page.getByTestId("person-total-ansh")).toHaveText("$5.29");
    await expect(page.getByTestId("person-total-ansh")).not.toHaveText("$2.65");
  });

  test("remainder $9.57 stays in Still open until claimed", async ({ page }) => {
    const { id } = await createGroceryReceipt(page);
    await openReview(page, id);
    await expect(page.getByTestId("line-value-remainder")).toHaveText("$9.57");
    await expect(page.getByTestId("line-amount-remainder")).toHaveCount(0);
    await expect(page.getByTestId("still-open")).toBeVisible();
    await expect(page.getByTestId("still-open")).toContainText("Rest of the bill");
    await expect(page.getByTestId("still-open-total")).toBeVisible();
    await page.getByTestId("owe-item_3").click();
    await expect(page.getByTestId("still-open")).toContainText("Rest of the bill");
    await page.getByTestId("owe-remainder").click();
    await expect(page.getByTestId("still-open")).not.toContainText("Rest of the bill");
  });

  test("invite sheet is WhatsApp + copy link, dismissible, and stubs do not block claims", async ({ page }) => {
    const { id, shareToken } = await createGroceryReceipt(page);
    await page.goto(`/review/${id}`);
    const sheet = page.getByTestId("invite-sheet");
    await expect(sheet).toBeVisible({ timeout: 45_000 });
    await expect(sheet.getByRole("heading", { name: "Invite your friend" })).toBeVisible();
    await expect(sheet).toContainText("create an account before they can accept");
    const whatsapp = page.getByTestId("invite-whatsapp");
    await expect(whatsapp).toHaveAttribute("href", /https:\/\/wa\.me\/\?text=/);
    await expect(whatsapp).toHaveAttribute("href", new RegExp(shareToken));
    await expect(whatsapp).not.toHaveAttribute("href", /as%3D/);
    await page.getByTestId("invite-copy").click();
    await expect(page.getByTestId("invite-copy")).toHaveText(/Copied/i);
    await page.getByTestId("invite-friend-name").fill("Goru");
    await page.getByTestId("invite-friend-add").click();
    await expect(whatsapp).toHaveAttribute("href", /as%3D/);
    await page.getByTestId("invite-dismiss").click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("waiting-banner")).toContainText("Waiting for Goru");
    await expect(page.getByTestId("paid-by-bar")).toBeVisible();
    await expect(page.getByTestId("owe-item_3")).toBeEnabled();
    await page.getByTestId("owe-item_3").click();
    await expect(page.getByTestId("person-total-ansh")).toHaveText("$5.29");
  });

  test("share picker has a view-only bill link and Goru's seat link on phone and desktop", async ({ page }) => {
    const { id, shareToken } = await createGroceryReceipt(page);
    await openReview(page, id);
    await page.getByTestId("share-open").click();
    await expect(page.getByTestId("share-picker")).toBeVisible();
    const viewWhatsapp = page.getByTestId("share-view-whatsapp");
    await expect(viewWhatsapp).toHaveAttribute("href", new RegExp(shareToken));
    await expect(viewWhatsapp).not.toHaveAttribute("href", /as%3D/);
    await page.getByTestId("share-picker-dismiss").click();

    await page.request.post(`/api/documents/${id}/invites`, { data: { displayName: "Goru" } });
    await page.reload();
    await dismissInvite(page);

    await page.getByTestId("share-open").click();
    await expect(page.getByTestId("share-seat-goru-whatsapp")).toHaveAttribute("href", /as%3D/);
    await expect(page.getByTestId("share-seat-goru-copy")).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    const copy = page.getByTestId("share-seat-goru-copy");
    const box = await copy.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(280);
  });

  test("Split equally with no friend opens the invite sheet, then splits after adding one", async ({ page }) => {
    const { id } = await createGroceryReceipt(page);
    await openReview(page, id);
    await page.getByTestId("split-item_3").click();
    const sheet = page.getByTestId("invite-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Add a friend to split" })).toBeVisible();
    await page.getByTestId("invite-friend-name").fill("Goru");
    await page.getByTestId("invite-friend-add").click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("split-item_3")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("line-item_3")).toContainText("$2.65 each");
    await expect(page.getByTestId("person-total-ansh")).toHaveText("$2.65");
    await expect(page.getByTestId("person-total-goru")).toHaveText("$2.65");
  });

  test("Split equally with two friends opens a picker and splits with the chosen person", async ({ page }) => {
    const group = await createGroup(page, "412 Oak");
    await addGroupMember(page, group.id, "Goru");
    await addGroupMember(page, group.id, "Priya");
    const { id } = await createGroceryReceipt(page, group.id);
    await openReview(page, id);
    await page.getByTestId("split-item_3").click();
    const picker = page.getByTestId("split-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("heading", { name: "Who shares it?" })).toBeVisible();
    await expect(page.getByTestId("split-picker-confirm")).toBeDisabled();
    await page.getByTestId("split-with-goru").click();
    await page.getByTestId("split-picker-confirm").click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByTestId("split-item_3")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("line-item_3")).toContainText("$2.65 each");
    await expect(page.getByTestId("person-total-ansh")).toHaveText("$2.65");
    await expect(page.getByTestId("person-total-goru")).toHaveText("$2.65");
    await expect(page.getByTestId("person-priya")).toHaveCount(0);
  });

  test("Not mine marks the line without taking it", async ({ page }) => {
    const { id } = await createGroceryReceipt(page);
    await openReview(page, id);
    await page.getByTestId("not-mine-item_6").click();
    await expect(page.getByTestId("not-mine-item_6")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("person-ansh")).toHaveCount(0);
  });

  test("paid by can switch to a group friend", async ({ page }) => {
    const group = await createGroup(page, "412 Oak");
    await addGroupMember(page, group.id, "Goru");
    const { id } = await createGroceryReceipt(page, group.id);
    await openReview(page, id);
    await expect(page.getByTestId("paid-by")).toHaveValue("Ansh");
    await page.getByTestId("paid-by").selectOption("Goru");
    await expect(page.getByTestId("paid-by")).toHaveValue("Goru");
    await page.reload();
    await dismissInvite(page);
    await expect(page.getByTestId("paid-by")).toHaveValue("Goru");
  });

  test("owner can rename and remove a line; total drops that line; share has no Remove", async ({ page }) => {
    const { id, shareToken } = await createGroceryReceipt(page);
    await openReview(page, id);
    await expect(page.getByTestId("line-label-item_3")).toHaveValue(/OAT MILK/i);
    await page.getByTestId("line-label-item_3").fill("Oat milk carton");
    await page.getByTestId("line-label-item_3").blur();
    await expect(page.getByTestId("line-label-item_3")).toHaveValue("Oat milk carton");
    await expect(page.getByTestId("line-value-total")).toHaveText("$84.20");
    await expect(page.getByTestId("line-value-remainder")).toHaveText("$9.57");
    await page.getByTestId("line-remove-item_1").click();
    await expect(page.getByTestId("line-item_1")).toHaveCount(0);
    await expect(page.getByTestId("line-value-total")).toHaveText("$67.64");
    await expect(page.getByTestId("line-value-remainder")).toHaveCount(0);
    await page.goto(`/s/${shareToken}`);
    await expect(page.getByTestId("line-item_3")).toBeVisible();
    await expect(page.getByTestId("line-value-total")).toHaveText("$67.64");
    await expect(page.getByTestId("line-remove-item_3")).toHaveCount(0);
    await expect(page.getByTestId("line-label-item_3")).toHaveCount(0);
  });

  test("editing an item amount recomputes TOTAL from visible lines", async ({ page }) => {
    const { id, shareToken } = await createGroceryReceipt(page);
    await openReview(page, id);
    await expect(page.getByTestId("line-value-total")).toHaveText("$84.20");
    const amount = page.getByTestId("line-amount-item_3");
    await amount.fill("6.29");
    await amount.blur();
    await expect(page.getByTestId("line-value-total")).toHaveText("$75.63");
    await expect(page.getByTestId("line-value-remainder")).toHaveCount(0);
    await page.reload();
    await dismissInvite(page);
    await expect(page.getByTestId("line-value-total")).toHaveText("$75.63");
    await page.goto(`/s/${shareToken}`);
    await expect(page.getByTestId("line-value-total")).toHaveText("$75.63");
  });

  test("phone row keeps name, amount, and × on one line", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const { id, shareToken } = await createGroceryReceipt(page);
    await openReview(page, id);
    const row = page.getByTestId("line-item_3");
    await row.scrollIntoViewIfNeeded();
    const name = page.getByTestId("line-label-item_3");
    const amount = page.getByTestId("line-amount-item_3");
    const remove = page.getByTestId("line-remove-item_3");
    const owe = page.getByTestId("owe-item_3");
    await expect(name).toBeVisible();
    await expect(amount).toBeVisible();
    await expect(remove).toBeVisible();
    await expect(remove).toHaveText("×");
    const nameBox = await name.boundingBox();
    const amountBox = await amount.boundingBox();
    const removeBox = await remove.boundingBox();
    const oweBox = await owe.boundingBox();
    expect(nameBox).toBeTruthy();
    expect(amountBox).toBeTruthy();
    expect(removeBox).toBeTruthy();
    expect(oweBox).toBeTruthy();
    expect(nameBox!.y + 8).toBeLessThan(amountBox!.y + amountBox!.height);
    expect(amountBox!.y + 8).toBeLessThan(nameBox!.y + nameBox!.height);
    expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(amountBox!.x + 2);
    expect(amountBox!.x + amountBox!.width).toBeLessThanOrEqual(removeBox!.x + 2);
    expect(removeBox!.width).toBeGreaterThanOrEqual(44);
    expect(removeBox!.height).toBeGreaterThanOrEqual(44);
    expect(await remove.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(nameBox!.x + nameBox!.width).toBeLessThan(375);
    expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(375);
    expect(oweBox!.x + oweBox!.width).toBeLessThanOrEqual(375);
    const totalAmt = page.getByTestId("line-amount-total");
    await totalAmt.scrollIntoViewIfNeeded();
    const totalBox = await totalAmt.boundingBox();
    expect(totalBox).toBeTruthy();
    expect(Math.abs(amountBox!.x + amountBox!.width - (totalBox!.x + totalBox!.width))).toBeLessThan(3);
    expect(totalBox!.x + totalBox!.width).toBeLessThanOrEqual(375 - 8);
    await expect(page.getByTestId("split-copy")).toHaveText("Copy", {
      useInnerText: true,
      ignoreCase: true,
    });
    await expect(name).toHaveAttribute("inputmode", "text");
    await expect(amount).toHaveAttribute("inputmode", "decimal");
    await page.goto(`/s/${shareToken}`);
    await expect(page.getByTestId("line-item_3")).toBeVisible();
    await expect(page.getByTestId("line-remove-item_3")).toHaveCount(0);
    await expect(page.getByTestId("line-label-item_3")).toHaveCount(0);
  });
});
