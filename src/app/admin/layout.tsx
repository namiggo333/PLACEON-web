import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이곳저곳 총괄 관리자",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
