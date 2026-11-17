import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "플레이스온 총괄 관리자",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
