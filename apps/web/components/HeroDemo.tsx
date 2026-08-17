import styles from "./hero-demo.module.css";

const DEMO_SRC = "/demo/vouch.mp4";
const DEMO_POSTER = "/demo/vouch-poster.jpg";

export function HeroDemo() {
  return (
    <figure className={styles.demo}>
      <p className={styles.eyebrow}>Film · 60 seconds</p>
      <div className={styles.frame}>
        <video
          aria-label="Vouch product demo"
          className={styles.video}
          controls
          playsInline
          poster={DEMO_POSTER}
          preload="metadata"
          data-testid="landing-demo"
        >
          <source src={DEMO_SRC} type="video/mp4" />
        </video>
      </div>
    </figure>
  );
}
