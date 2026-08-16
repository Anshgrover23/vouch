/**
 * Playwright e2e for Vouch. Requires Postgres (`pnpm local` or Docker on :5432)
 * and a Next server on http://localhost:3000.
 */
import { expect, test } from "@playwright/test";
import {
  addGroupMember,
  createGroceryReceipt,
  createGroup,
  dismissInvite,
  openReview,
  readyContext,
  uniqueEmail,
  PASSWORD,
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
    await ansh.getByTestId("owe-item_3").click();
    await expect(ansh.getByTestId("person-total-ansh")).toHaveText("$5.29");

    await goru.goto(`/s/${shareToken}`);
    await expect(goru.getByTestId("owe-item_6")).toBeVisible();
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
    await expect(ansh.getByTestId("person-ansh")).toBeVisible();

    await anshContext.close();
    await goruContext.close();
  });

  test("Ansh splits oat milk with Goru; Goru sees $2.65 without tapping Split equally", async ({ browser }) => {
    const anshContext = await browser.newContext();
    const goruContext = await browser.newContext();
    const ansh = await readyContext(anshContext, { name: "Ansh", email: uniqueEmail("split-ansh") });
    const goru = await readyContext(goruContext, { name: "Goru", email: uniqueEmail("split-goru") });

    const group = await createGroup(ansh, "412 Oak");
    const goruSeat = await addGroupMember(ansh, group.id, "Goru");
    const { id, shareToken } = await createGroceryReceipt(ansh, group.id);
    await openReview(ansh, id);
    await ansh.getByTestId("split-item_3").click();
    await expect(ansh.getByTestId("line-item_3")).toContainText("$2.65 each");
    await expect(ansh.getByTestId("person-total-ansh")).toHaveText("$2.65");
    await expect(ansh.getByTestId("person-total-goru")).toHaveText("$2.65");

    await goru.goto(`/s/${shareToken}?as=${encodeURIComponent(goruSeat.inviteToken)}`);
    await expect(goru.getByTestId("line-item_3")).toContainText("$2.65 each");
    await expect(goru.getByTestId("person-total-ansh")).toHaveText("$2.65");
    await expect(goru.getByTestId("person-total-goru")).toHaveText("$2.65");
    await expect(goru.getByTestId("split-item_3")).toHaveAttribute("aria-pressed", "true");

    await anshContext.close();
    await goruContext.close();
  });

  test("Goru's link signs up without a name field and keeps the $2.65", async ({ browser }) => {
    const anshContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const ansh = await readyContext(anshContext, { name: "Ansh", email: uniqueEmail("seat-ansh") });
    const group = await createGroup(ansh, "412 Oak");
    const goruSeat = await addGroupMember(ansh, group.id, "Goru");
    const { id, shareToken } = await createGroceryReceipt(ansh, group.id);
    await openReview(ansh, id);
    await ansh.getByTestId("split-item_3").click();
    await expect(ansh.getByTestId("person-total-goru")).toHaveText("$2.65");

    const guest = await guestContext.newPage();
    await guest.goto(`/s/${shareToken}?as=${encodeURIComponent(goruSeat.inviteToken)}`);
    await expect(guest.getByTestId("share-gate")).toContainText("Goru");
    await expect(guest.getByTestId("person-total-goru")).toHaveText("$2.65");
    await expect(guest.getByTestId("split-item_3")).toHaveAttribute("aria-pressed", "true");
    await guest.getByTestId("share-signup").click();
    await guest.waitForURL(/\/signup\?invite=/);
    await expect(guest.getByTestId("auth-name")).toHaveCount(0);
    await expect(guest.getByTestId("signup-seat")).toContainText("Goru");
    await guest.getByTestId("auth-email").fill(uniqueEmail("goru-join"));
    await guest.getByTestId("auth-password").fill(PASSWORD);
    await guest.getByTestId("auth-submit").click();
    await guest.waitForURL((url) => url.pathname === `/s/${shareToken}`);
    await expect(guest.getByTestId("person-total-goru")).toHaveText("$2.65");
    await expect(guest.getByTestId("split-item_3")).toHaveAttribute("aria-pressed", "true");

    await anshContext.close();
    await guestContext.close();
  });

  test("Harshita on the view-only link does not get Goru's share", async ({ browser }) => {
    const anshContext = await browser.newContext();
    const harshitaContext = await browser.newContext();
    const ansh = await readyContext(anshContext, { name: "Ansh", email: uniqueEmail("view-ansh") });
    const harshita = await readyContext(harshitaContext, { name: "Harshita", email: uniqueEmail("view-harshita") });
    const group = await createGroup(ansh, "412 Oak");
    await addGroupMember(ansh, group.id, "Goru");
    const { id, shareToken } = await createGroceryReceipt(ansh, group.id);
    await openReview(ansh, id);
    await ansh.getByTestId("split-item_3").click();
    await expect(ansh.getByTestId("person-total-goru")).toHaveText("$2.65");

    await harshita.goto(`/s/${shareToken}`);
    await expect(harshita.getByTestId("person-total-goru")).toHaveText("$2.65");
    await expect(harshita.getByTestId("split-item_3")).toHaveAttribute("aria-pressed", "false");
    await expect(harshita.getByTestId("person-total-harshita")).toHaveCount(0);

    await anshContext.close();
    await harshitaContext.close();
  });

  test("renaming Goru to Goru1 updates the board", async ({ browser }) => {
    const anshContext = await browser.newContext();
    const goruContext = await browser.newContext();
    const ansh = await readyContext(anshContext, { name: "Ansh", email: uniqueEmail("rename-ansh") });
    const goru = await readyContext(goruContext, { name: "Goru", email: uniqueEmail("rename-goru") });
    const group = await createGroup(ansh, "412 Oak");
    const goruSeat = await addGroupMember(ansh, group.id, "Goru");
    const { id, shareToken } = await createGroceryReceipt(ansh, group.id);
    await openReview(ansh, id);
    await ansh.getByTestId("split-item_3").click();
    await expect(ansh.getByTestId("person-total-goru")).toHaveText("$2.65");

    await goru.goto(`/s/${shareToken}?as=${encodeURIComponent(goruSeat.inviteToken)}`);
    await expect(goru.getByTestId("person-total-goru")).toHaveText("$2.65");
    await goru.goto("/account");
    await goru.getByTestId("account-name").fill("Goru1");
    await goru.getByTestId("account-name-save").click();
    await expect(goru.getByText("Name saved")).toBeVisible();
    await goru.goto(`/s/${shareToken}?as=${encodeURIComponent(goruSeat.inviteToken)}`);
    await expect(goru.getByTestId("person-total-goru1")).toHaveText("$2.65");
    await expect(goru.getByTestId("person-goru")).toHaveCount(0);
    await expect(goru.getByTestId("split-item_3")).toHaveAttribute("aria-pressed", "true");

    await ansh.reload();
    await dismissInvite(ansh);
    await expect(ansh.getByTestId("person-total-goru1")).toHaveText("$2.65");

    await anshContext.close();
    await goruContext.close();
  });
});
