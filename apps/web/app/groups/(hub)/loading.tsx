import { GroupsListSkeleton } from "../GroupsHub";
import styles from "../groups.module.css";

export default function GroupsLoading() {
  return (
    <>
      <div className={styles.create} aria-hidden="true">
        <span className={styles.skelLine} />
        <span className={`${styles.skelLine} ${styles.skelLineShort}`} />
        <div className={styles.skelForm} />
      </div>
      <GroupsListSkeleton />
    </>
  );
}
