import type { Metadata } from "next";
import ViewDeckPageWithIdentifierClient from "./ViewDeckPageWithIdentifierClient";
import { buildDeckViewMetadata } from "@/lib/view-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { token?: string };
}): Promise<Metadata> {
  return buildDeckViewMetadata(searchParams?.token);
}

export default function ViewDeckPageWithIdentifier() {
  return <ViewDeckPageWithIdentifierClient />;
}
