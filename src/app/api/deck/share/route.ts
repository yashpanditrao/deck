import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateDeckUser } from "@/lib/deck-user";
import { generateShareToken } from "@/lib/deck-sharing";

const VALID_EXPIRATION_DAYS = [7, 30, 90, 180, 365];
const VALID_ACCESS_LEVELS = ["public", "restricted", "whitelisted"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const buildShareUrl = (token: string) => {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";

  if (!base) return null;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/view?token=${token}`;
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getOrCreateDeckUser(user);

    const { searchParams } = new URL(request.url);
    const deckId = searchParams.get("deckId");

    let query = supabaseAdmin
      .from("deck_share_links")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (deckId) {
      query = query.eq("deck_id", deckId);
    }

    const { data: shareLinks, error } = await query;

    if (error) {
      console.error("Failed to fetch share links:", error);
      return NextResponse.json(
        { error: "Failed to fetch share links" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      shareLinks: shareLinks || [],
    });
  } catch (error) {
    console.error("Error in share GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckUser = await getOrCreateDeckUser(user);
    const {
      deckId,
      access_level = "restricted",
      recipient_email,
      allowed_emails,
      allowed_domains,
      expiration_days,
      is_downloadable = false,
    } = await request.json();

    if (!deckId) {
      return NextResponse.json(
        { error: "Deck ID is required to create a share link" },
        { status: 400 },
      );
    }

    if (!VALID_ACCESS_LEVELS.includes(access_level)) {
      return NextResponse.json(
        { error: "Invalid access level selection" },
        { status: 400 },
      );
    }

    if (
      access_level === "whitelisted" &&
      (!recipient_email || !recipient_email.includes("@"))
    ) {
      return NextResponse.json(
        { error: "Recipient email is required for whitelisted links" },
        { status: 400 },
      );
    }

    const { data: deckRecord, error: deckError } = await supabaseAdmin
      .from("deck_files")
      .select("id")
      .eq("id", deckId)
      .eq("user_id", deckUser.id)
      .single();

    if (deckError || !deckRecord) {
      return NextResponse.json(
        { error: "Deck not found or unauthorized" },
        { status: 404 },
      );
    }

    const selectedDays = VALID_EXPIRATION_DAYS.includes(
      parseInt(expiration_days),
    )
      ? parseInt(expiration_days)
      : 30;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + selectedDays);

    const token = generateShareToken();
    const allowedEmails =
      access_level === "whitelisted" &&
      Array.isArray(allowed_emails) &&
      allowed_emails.length > 0
        ? allowed_emails.map((email: string) => email.trim().toLowerCase())
        : null;

    const allowedDomains =
      access_level === "whitelisted" &&
      Array.isArray(allowed_domains) &&
      allowed_domains.length > 0
        ? allowed_domains.map((domain: string) => domain.trim().toLowerCase())
        : null;

    const shareInsert = {
      deck_id: deckRecord.id,
      user_id: deckUser.id,
      token,
      access_level,
      allowed_emails: access_level === "whitelisted" ? allowedEmails : null,
      allowed_domains: access_level === "whitelisted" ? allowedDomains : null,
      recipient_email:
        access_level === "whitelisted"
          ? (recipient_email?.toLowerCase().trim() ?? null)
          : null,
      is_downloadable: Boolean(is_downloadable),
      expires_at: expiresAt.toISOString(),
      allow_anonymous: access_level === "public",
      require_verification: access_level !== "public",
    };

    const { data: shareLink, error: shareError } = await supabaseAdmin
      .from("deck_share_links")
      .insert(shareInsert)
      .select()
      .single();

    if (shareError || !shareLink) {
      console.error("Failed to create share link:", shareError);
      return NextResponse.json(
        { error: "Failed to create share link" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Share link created and valid for ${selectedDays} days`,
      shareLink,
      share_url: buildShareUrl(token),
    });
  } catch (error) {
    console.error("Error in share POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Share token is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("deck_share_links")
      .delete()
      .eq("token", token)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to delete share link:", error);
      return NextResponse.json(
        { error: "Failed to delete share link" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in share DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
