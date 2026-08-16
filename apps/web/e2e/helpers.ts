import { expect, type BrowserContext, type Page } from "@playwright/test";

export const PASSWORD = "password1";
export const SAMPLE_RECEIPT = "public/samples/receipt.png";
export const SAMPLE_PAYMENT = "public/samples/payment.png";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}@vouch.test`;
}

export async function signupViaUi(page: Page, account: { name: string; email: string; password?: string }) {
  await page.goto("/signup");
  await page.getByTestId("auth-name").fill(account.name);
  await page.getByTestId("auth-email").fill(account.email);
  await page.getByTestId("auth-password").fill(account.password ?? PASSWORD);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/onboarding/);
}

export async function loginViaUi(
  page: Page,
  account: { email: string; password?: string; next?: string },
) {
  const dest = account.next ? `/login?next=${encodeURIComponent(account.next)}` : "/login";
  await page.goto(dest);
  await page.getByTestId("auth-email").fill(account.email);
  await page.getByTestId("auth-password").fill(account.password ?? PASSWORD);
  await page.getByTestId("auth-submit").click();
}

export async function logoutViaUi(page: Page) {
  await page.goto("/account");
  await page.getByTestId("account-logout").getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("/");
}

export async function signupViaApi(
  page: Page,
  account: { name: string; email: string; password?: string },
) {
  const res = await page.request.post("/api/auth/signup", {
    data: {
      displayName: account.name,
      email: account.email,
      password: account.password ?? PASSWORD,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function skipOnboarding(page: Page) {
  const res = await page.request.post("/api/onboarding", { data: { path: "skip" } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function becomeOnboarded(page: Page) {
  await skipOnboarding(page);
  await page.goto("/new");
  await page.waitForURL(/\/new/);
}

export async function createGroceryReceipt(page: Page, groupId?: string) {
  const created = await page.request.post("/api/documents", {
    data: { slug: "grocery-receipt", groupId },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const body = (await created.json()) as { document: { id: string } };
  const id = body.document.id;
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/documents/${id}`);
        if (!res.ok()) return "missing";
        const json = (await res.json()) as { document?: { status?: string } };
        return json.document?.status ?? "missing";
      },
      { timeout: 45_000 },
    )
    .not.toMatch(/^(uploaded|processing)$/);
  const doc = await page.request.get(`/api/documents/${id}`);
  const json = (await doc.json()) as { document: { shareToken: string } };
  return { id, shareToken: json.document.shareToken };
}

export async function createGroup(page: Page, name: string) {
  const res = await page.request.post("/api/groups", { data: { name } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const json = (await res.json()) as { group: { id: string; name: string } };
  return json.group;
}

export async function addGroupMember(page: Page, groupId: string, displayName: string) {
  const res = await page.request.post(`/api/groups/${groupId}/members`, { data: { displayName } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const json = (await res.json()) as {
    member: { id: string; displayName: string; inviteToken: string; status: string };
  };
  return json.member;
}

export async function documentSeats(page: Page, id: string) {
  const res = await page.request.get(`/api/documents/${id}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  const json = (await res.json()) as {
    seats?: Array<{ displayName: string; inviteToken: string; you?: boolean }>;
  };
  return json.seats ?? [];
}

export async function dismissInvite(page: Page) {
  const sheet = page.getByTestId("invite-sheet");
  await expect(page.getByTestId("paid-by-bar").or(page.getByTestId("review-lines")).or(sheet).first()).toBeVisible({
    timeout: 45_000,
  });
  await sheet.waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
  if (await sheet.isVisible()) {
    await page.getByTestId("invite-dismiss").click();
    await expect(sheet).toHaveCount(0);
  }
}

export async function openReview(page: Page, id: string) {
  await page.goto(`/review/${id}`);
  await dismissInvite(page);
  await expect(page.getByTestId("paid-by-bar")).toBeVisible();
}

export async function readyContext(context: BrowserContext, account: { name: string; email: string }) {
  const page = await context.newPage();
  await signupViaApi(page, account);
  await becomeOnboarded(page);
  return page;
}

export async function typeManualReceipt(
  page: Page,
  receipt: { merchant: string; date?: string; total: string; item: string; price: string },
) {
  await page.getByTestId("new-manual").click();
  await page.getByTestId("manual-merchant").fill(receipt.merchant);
  if (receipt.date) await page.getByTestId("manual-date").fill(receipt.date);
  await page.getByTestId("manual-total").fill(receipt.total);
  await page.getByTestId("manual-item-name-0").fill(receipt.item);
  await page.getByTestId("manual-item-price-0").fill(receipt.price);
  await page.getByTestId("manual-submit").click();
  await page.waitForURL(/\/review\//);
}
