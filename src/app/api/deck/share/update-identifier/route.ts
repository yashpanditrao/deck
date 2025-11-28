import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const sanitizeIdentifier = (value: string) => {
  // Only allow alphanumeric, hyphens, and underscores
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
  if (!sanitized || sanitized.length === 0) {
    throw new Error('Identifier cannot be empty after sanitization');
  }
  if (sanitized.length > 50) {
    throw new Error('Identifier must be 50 characters or less');
  }
  return sanitized;
};

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token, identifier } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: "Identifier is required and must be a string" },
        { status: 400 }
      );
    }

    // Sanitize the identifier
    let sanitizedIdentifier: string;
    try {
      sanitizedIdentifier = sanitizeIdentifier(identifier);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || "Invalid identifier format" },
        { status: 400 }
      );
    }

    // Verify the share link belongs to the user
    const { data: shareLink, error: fetchError } = await supabaseAdmin
      .from("deck_share_links")
      .select("id, user_id")
      .eq("token", token)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !shareLink) {
      return NextResponse.json(
        { error: "Share link not found or unauthorized" },
        { status: 404 }
      );
    }

    // Check if identifier is already taken by another link from the same user
    const { data: existingLink, error: checkError } = await supabaseAdmin
      .from("deck_share_links")
      .select("id")
      .eq("user_id", user.id)
      .eq("link_identifier", sanitizedIdentifier)
      .neq("token", token)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking existing identifier:", checkError);
      return NextResponse.json(
        { error: "Failed to check identifier availability" },
        { status: 500 }
      );
    }

    if (existingLink) {
      return NextResponse.json(
        { error: "This identifier is already in use by another link" },
        { status: 409 }
      );
    }

    // Update the link identifier
    const { data: updatedLink, error: updateError } = await supabaseAdmin
      .from("deck_share_links")
      .update({ link_identifier: sanitizedIdentifier })
      .eq("token", token)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !updatedLink) {
      console.error("Failed to update link identifier:", updateError);
      return NextResponse.json(
        { error: "Failed to update link identifier" },
        { status: 500 }
      );
    }

    // Build the URL - use format: /[identifier]/view?token=[token]
    const base =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
    const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const shareUrl = `${normalizedBase}/${encodeURIComponent(sanitizedIdentifier)}/view?token=${token}`;

    return NextResponse.json({
      success: true,
      message: "Link identifier updated successfully",
      shareLink: updatedLink,
      share_url: shareUrl,
    });
  } catch (error) {
    console.error("Error in update identifier PATCH:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

