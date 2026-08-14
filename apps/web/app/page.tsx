import { SiteFooter } from "@/components/Chrome";
import { SiteChrome } from "@/components/SiteChrome";
import { ReceiptPoster } from "@/components/ReceiptPoster";
import { IconArrow, IconCamera, IconCheck, IconShare, IconTap } from "@/components/Brand";
import { getSession } from "@/lib/auth";
import styles from "./landing.module.css";

const ticker = [
  "I didn't even eat the pizza",
  "The oat milk isn't mine",
  "You can't Venmo-request me for gas",
  "Split evenly? Not this Costco run",
];

export default async function LandingPage() {
  const session = await getSession();
  return (
    <>
      <SiteChrome />
      <div className={styles.ticker} aria-hidden="true">
        <div className={styles.tickerTrack}>
          {[...ticker, ...ticker].map((line, i) => (
            <span key={`${line}-${i}`}>
              {line}
              <b>◆</b>
            </span>
          ))}
        </div>
      </div>
      <main className={styles.root}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.badge}>The anti-Splitwise</p>
            <h1>
              Split the <em>receipt</em>, not the friendship.
            </h1>
            <p className={styles.lede}>
              Upload the crumpled receipt. Housemates tap the lines they actually owe. Everyone vouches. Nobody argues about organic blueberries.
            </p>
            {session ? <SignedInHeroActions /> : <GuestHeroActions />}
            <ul className={styles.checks}>
              <li>
                <IconCheck /> Share by link
              </li>
              <li>
                <IconCheck /> Groups and balances
              </li>
              <li>
                <IconCheck /> AI reads the paper
              </li>
            </ul>
          </div>
          <ReceiptPoster />
        </section>

        <section className={styles.steps} id="how">
          <div className={styles.stepsHead}>
            <h2>Three taps. No fights.</h2>
            <p className={styles.monoLede}>Splitwise makes you type. Vouch makes you tap. The receipt is the proof.</p>
          </div>
          <div className={styles.stepGrid}>
            <article>
              <p className="mono">
                <IconCamera /> Step 01
              </p>
              <h3>Snap the receipt</h3>
              <p>Upload a receipt or type the lines. AI pulls merchant, date, total, and every priced item when you snap.</p>
            </article>
            <article>
              <p className="mono">
                <IconTap /> Step 02
              </p>
              <h3>Tap what you owe</h3>
              <p>Housemates mark I owe this or not mine. Smudged lines stay flagged until someone checks them.</p>
            </article>
            <article>
              <p className="mono">
                <IconShare /> Step 03
              </p>
              <h3>See who owes what</h3>
              <p>Send the link. Housemates tap their lines. The chat gets a clean split, not a fight.</p>
            </article>
          </div>
        </section>

        <section className={styles.product} id="features" data-testid="landing-product">
          <div className={styles.stepsHead}>
            <h2>Households, not spreadsheets.</h2>
            <p className={styles.monoLede}>Groups, who owes whom, snap or type. The paper is still the proof.</p>
          </div>
          <div className={styles.productGrid}>
            <article className={styles.lime} data-testid="product-groups">
              <p className="mono">Groups</p>
              <h3>412 Oak, a trip, whoever</h3>
              <p>Skip onboarding. Start a group later. Add people by name before they join.</p>
            </article>
            <article className={styles.pink} data-testid="product-type">
              <p className="mono">Type it</p>
              <h3>No photo? Type the lines</h3>
              <p>Same tap canvas. Merchant, date, totals — then I owe this.</p>
            </article>
            <article className={styles.blue} data-testid="product-settle">
              <p className="mono">Settle up</p>
              <h3>Who owes whom</h3>
              <p>After the receipt is vouched, the group shows the pairwise debt. Mark it settled in Vouch.</p>
            </article>
          </div>
        </section>

        <section className={styles.void} id="share">
          <div className={styles.voidCopy}>
            <p className={styles.petty}>Petty. Social. Weekly.</p>
            <h2>Nobody trusts the total.</h2>
            <p>
              Splitwise types the numbers. Vouch reads the paper. Every line has a witness. Every witness has a name. Every total is receipt-shaped truth.
            </p>
            {session ? (
              <a className="btn btn-lime" href="/new" data-testid="landing-void-new">
                New receipt
                <IconArrow />
              </a>
            ) : (
              <a className="btn btn-lime" href="/signup">
                Start a split
                <IconArrow />
              </a>
            )}
          </div>
          <div className={styles.uses}>
            <article className={styles.lime}>
              <p className="mono">Use it for</p>
              <h3>Grocery runs</h3>
            </article>
            <article className={styles.pink}>
              <p className="mono">Use it for</p>
              <h3>Restaurant tabs</h3>
            </article>
            <article className={styles.blue}>
              <p className="mono">Use it for</p>
              <h3>Airbnb totals</h3>
            </article>
            <article className={styles.orange}>
              <p className="mono">Use it for</p>
              <h3>Venmo receipts</h3>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function GuestHeroActions() {
  return (
    <div className={styles.actions}>
      <a className="btn btn-primary" href="/signup" data-testid="landing-signup">
        Get started
        <IconArrow />
      </a>
      <a className="btn" href="#how" data-testid="landing-how">
        How it works
      </a>
    </div>
  );
}

function SignedInHeroActions() {
  return (
    <div className={styles.actions}>
      <a className="btn btn-primary" href="/new" data-testid="landing-new">
        New receipt
        <IconArrow />
      </a>
      <a className="btn" href="/inbox" data-testid="landing-splits">
        Your splits
      </a>
    </div>
  );
}
