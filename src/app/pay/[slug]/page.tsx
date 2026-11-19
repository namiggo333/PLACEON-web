import type { Metadata } from "next";
import PayView from "./PayView";
import { fetchPublicSpaceBySlug } from "@/lib/server-data";
import { NOINDEX, SITE_NAME, payMetadata } from "@/lib/seo";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const space = await fetchPublicSpaceBySlug(slug);
  if (!space) {
    return { title: `예약 링크를 찾을 수 없어요 | ${SITE_NAME}`, robots: NOINDEX };
  }
  return payMetadata(space);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  await params;
  return <PayView />;
}
