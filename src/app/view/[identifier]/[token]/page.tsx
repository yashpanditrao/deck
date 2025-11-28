import type { Metadata } from "next";
import ViewDeckPageWithIdentifierClient from "./ViewDeckPageWithIdentifierClient";
import { buildDeckViewMetadata } from "@/lib/view-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { identifier: string; token: string };
}): Promise<Metadata> {
  return buildDeckViewMetadata(params?.token);
}

export default function ViewDeckPageWithIdentifier() {
  return <ViewDeckPageWithIdentifierClient />;
}
