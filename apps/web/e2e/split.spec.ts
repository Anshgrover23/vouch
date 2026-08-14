/**
 * Playwright e2e for Vouch. Requires Postgres (`pnpm local` or Docker on :5432)
 * and a Next server on http://localhost:3000.
 */
import { expect, test } from "@playwright/test";
import {
  confirmIdentity,
  createGroceryReceipt,
  dismissInvite,
  openReview,
  readyContext,
  uniqueEmail,
} from "./helpers";

test.describe("join link and two browsers", () => {
  test("logged-out user can view /s/{token} but claiming goes to signup?next=", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const owner = await readyContext(ownerContext, { name: "Ansh", email: uniqueEmail("owner") });
    const { shareToken } = await createGroceryReceipt(owner);

    const guest = await guestContext.newPage();
    await guest.goto(`/s/${shareToken}`);
    await expect(guest.getByTestId("share-gate")).toBeVisible();
    await expect(guest.getByTestId("split-board")).toBeVisible();
    await expect(guest.getByTestId("line-value-merchant")).toBeVisible();
    await guest.getByTestId("owe-item_3").click();
    await guest.waitForURL(/\/signup\?next=/);
    expect(guest.url()).toContain(shareToken);

    await ownerContext.close();
    await guestContext.close();
  });

  test("Ansh on review and Goru on the join link share oat milk $2.65 each", async ({ browser }) => {
    const anshContext = await browser.newContext();
    const goruContext = await browser.newContext();
    const ansh = await readyContext(anshContext, { name: "Ansh", email: uniqueEmail("ansh") });
    const goru = await readyContext(goruContext, { name: "Goru", email: uniqueEmail("goru") });

    const { id, shareToken } = await createGroceryReceipt(ansh);
    await openReview(ansh, id);
    await confirmIdentity(ansh, "Ansh");
    await ansh.getByTestId("owe-item_3").click();
    await expect(ansh.getByTestId("person-total-ansh")).toHaveText("$5.29");

    await goru.goto(`/s/${shareToken}`);
    await expect(goru.getByTestId("identity-bar")).toBeVisible();
    await confirmIdentity(goru, "Goru");
    await goru.getByTestId("owe-item_6").click();
    await expect(goru.getByTestId("person-goru")).toBeVisible();
    await goru.getByTestId("split-item_3").click();

    await expect(goru.getByTestId("person-ansh")).toBeVisible();
    await expect(goru.getByTestId("person-goru")).toBeVisible();
    await expect(goru.getByTestId("person-total-ansh")).toHaveText("$2.65");
    await expect(goru.getByTestId("line-item_3")).toContainText("$2.65 each");
    await expect(goru.getByTestId("person-goru")).toContainText(/eggs/i);

    await expect
      .poll(async () => {
        await ansh.reload();
        await dismissInvite(ansh);
        return ansh.getByTestId("person-total-ansh").textContent();
      })
      .toBe("$2.65");
    await expect(ansh.getByTestId("person-goru")).toBeVisible();

    await confirmIdentity(ansh, "Ansh-grover");
    await expect(ansh.getByTestId("person-ansh-grover")).toBeVisible();
    await expect(ansh.getByTestId("person-goru")).toBeVisible();
    await expect(ansh.getByTestId("person-ansh")).toHaveCount(0);

    await anshContext.close();
    await goruContext.close();
  });

  test("both tap Split equally on oat milk and each owe $2.65", async ({ browser }) => {
    const anshContext = await browser.newContext();
    const goruContext = await browser.newContext();
    const ansh = await readyContext(anshContext, { name: "Ansh", email: uniqueEmail("split-ansh") });
    const goru = await readyContext(goruContext, { name: "Goru", email: uniqueEmail("split-goru") });

    const { id, shareToken } = await createGroceryReceipt(ansh);
    await openReview(ansh, id);
    await confirmIdentity(ansh, "Ansh");
    await ansh.getByTestId("split-item_3").click();
    await expect(ansh.getByTestId("person-total-ansh")).toHaveText("$5.29");

    await goru.goto(`/s/${shareToken}`);
    await confirmIdentity(goru, "Goru");
    await goru.getByTestId("split-item_3").click();
    await expect(goru.getByTestId("line-item_3")).toContainText("$2.65 each");
    await expect(goru.getByTestId("person-total-ansh")).toHaveText("$2.65");
    await expect(goru.getByTestId("person-total-goru")).toHaveText("$2.65");

    await anshContext.close();
    await goruContext.close();
  });
});
