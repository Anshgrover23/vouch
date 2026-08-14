import { SiteChrome } from "@/components/SiteChrome";

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteChrome />
      {children}
    </>
  );
}
