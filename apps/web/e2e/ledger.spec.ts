import { expect, test } from "@playwright/test";
import {
  addGroupMember,
  confirmIdentity,
  createGroceryReceipt,
  createGroup,
  dismissInvite,
  openReview,
  readyContext,
  skipOnboarding,
  signupViaApi,
  uniqueEmail,
} from "./helpers";

test.describe("group ledger", () => {
  test("tabs, search, rename, Hillcrest balance, and mark settled", async ({ browser }) => {
    const anshContext = await browser.newContext();
    const goruContext = await browser.newContext();
    const ansh = await anshContext.newPage();
    await signupViaApi(ansh, { name: "Ansh", email: uniqueEmail("ledger-ansh") });
    await skipOnboarding(ansh);

    const group = await createGroup(ansh, "412 Oak");
    await addGroupMember(ansh, group.id, "Goru");
    const { id, shareToken } = await createGroceryReceipt(ansh, group.id);

    await ansh.goto(`/groups/${group.id}`);
    await expect(ansh.getByTestId("group-back")).toBeVisible();
    await expect(ansh.getByTestId("group-new-receipt")).toBeVisible();
    await expect(ansh.getByRole("link", { name: "New receipt" })).toHaveCount(1);
    await expect(ansh.getByTestId("group-tab-receipts")).toBeVisible();
    await expect(ansh.getByTestId("group-tab-balances")).toBeVisible();
    await expect(ansh.getByTestId("group-tab-totals")).toBeVisible();
    await expect(ansh.getByTestId("group-tab-activity")).toBeVisible();
    await expect(ansh.getByTestId("group-tab-settings")).toBeVisible();
    await expect(ansh.getByTestId("receipts-list")).toContainText(/Hillcrest/i);

    await ansh.getByTestId("receipts-search").fill("Hillcrest");
    await expect(ansh.getByTestId("receipts-list")).toContainText(/Hillcrest/i);
    await ansh.getByTestId("receipts-search").fill("zzzz");
    await expect(ansh.getByText("No receipts in this group yet.")).toBeVisible();
    await ansh.getByTestId("receipts-search").fill("");

    await ansh.getByTestId("group-tab-settings").click();
    await expect(ansh).toHaveURL(new RegExp(`/groups/${group.id}/settings`));
    await ansh.getByTestId("settings-name").fill("412 Oak house");
    await ansh.getByTestId("settings-save").click();
    await expect(ansh.getByRole("heading", { name: "412 Oak house" })).toBeVisible();

    await openReview(ansh, id);
    await confirmIdentity(ansh, "Ansh");
    await expect(ansh.getByTestId("paid-by")).toHaveValue("Ansh");

    const goru = await readyContext(goruContext, { name: "Goru", email: uniqueEmail("ledger-goru") });
    await goru.goto(`/s/${shareToken}`);
    await expect(goru.getByTestId("identity-bar")).toBeVisible();
    await confirmIdentity(goru, "Goru");
    await goru.getByTestId("owe-item_6").click();
    await expect(goru.getByTestId("person-goru")).toBeVisible();

    await ansh.goto(`/groups/${group.id}/balances`);
    await expect(ansh.getByTestId("balance-ansh")).toBeVisible();
    await expect(ansh.getByTestId("balance-goru")).toBeVisible();
    await expect(ansh.getByTestId("suggested-goru-ansh")).toContainText("$8.91");
    await ansh.getByTestId("mark-settled").click();
    await expect(ansh.getByTestId("suggested-empty")).toBeVisible();
    await expect(ansh.getByTestId("suggested-goru-ansh")).toHaveCount(0);

    await ansh.getByTestId("group-tab-totals").click();
    await expect(ansh.getByTestId("totals-spending")).toHaveText("$84.20");
    await expect(ansh.getByTestId("totals-you-paid")).toHaveText("$84.20");

    await ansh.getByTestId("group-tab-activity").click();
    await expect(ansh.getByTestId("activity-list")).toContainText(/settled/i);

    await anshContext.close();
    await goruContext.close();
  });
});
