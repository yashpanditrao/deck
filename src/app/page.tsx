import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";

const SOCIAL_IMAGE = "/social-share-rg.png";

export const metadata: Metadata = {
  title: "RaiseGate Deck Sharing",
  description:
    "Launch investor-ready decks in minutes. Upload PDFs, control access, and monitor engagement with RaiseGate Deck Sharing.",
  openGraph: {
    title: "RaiseGate Deck Sharing",
    description:
      "Upload polished PDFs, issue tamper-proof links, and track every investor interaction.",
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1200,
        height: 630,
        alt: "RaiseGate deck sharing preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RaiseGate Deck Sharing",
    description:
      "Upload polished PDFs, issue tamper-proof links, and track every investor interaction.",
    images: [SOCIAL_IMAGE],
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
