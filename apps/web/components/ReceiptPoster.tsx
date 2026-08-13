import styles from "./receipt-poster.module.css";

const lines = [
  { name: "Organic blueberries", price: "6.99", who: "lime" as const },
  { name: "Rotisserie chicken", price: "7.99", who: "pink" as const },
  { name: "Oat milk 6-pack", price: "12.49", who: null },
  { name: "Sourdough loaf", price: "4.49", who: "lime" as const },
  { name: "Sparkling water", price: "7.99", who: null },
];

export function ReceiptPoster() {
  return (
    <div className={styles.wrap}>
      <span className={`${styles.sticker} ${styles.sam}`}>Sam vouched</span>
      <figure className={styles.sheet}>
        <figcaption className={styles.meta}>
          <span>Costco #142</span>
          <span>13 Aug</span>
        </figcaption>
        <p className={styles.title}>Receipt</p>
        <ul>
          {lines.map((line) => (
            <li key={line.name}>
              <span className={`${styles.box} ${line.who === "lime" ? styles.boxLime : ""} ${line.who === "pink" ? styles.boxPink : ""}`} />
              <span>{line.name}</span>
              <b>${line.price}</b>
            </li>
          ))}
        </ul>
        <p className={styles.total}>
          <span>Total</span>
          <strong>$67.46</strong>
        </p>
      </figure>
      <span className={`${styles.sticker} ${styles.riley}`}>Riley vouched</span>
    </div>
  );
}
