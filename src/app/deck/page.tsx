"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Loader2,
  LogOut,
  PenSquare,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Link2,
  Sparkles,
  Shield,
  Clock4,
  Share2,
  Eye,
  BarChart3,
  Users,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { GoogleIcon } from "@/components/google-icon";

interface DeckFile {
  id: string;
  user_id: string;
  file_path: string;
  uploaded_at: string;
  thumbnail_path: string | null;
}

interface DeckShareLink {
  id: string;
  deck_id: string;
  token: string;
  link_identifier: string | null;
  access_level: "public" | "restricted" | "whitelisted";
  recipient_email: string | null;
  allowed_emails: string[] | null;
  allowed_domains: string[] | null;
  is_downloadable: boolean;
  expires_at: string | null;
  created_at: string;
}

interface DeckAnalyticsResponse {
  summary: {
    totalViews: number;
    uniqueViewers: number;
    avgDuration: number;
    completionRate: number;
  };
  pageEngagement: { page: number; views: number }[];
  recentViewers: {
    id: string;
    viewer: string;
    startedAt: string;
    duration: number | null;
    pagesViewed: number;
    completed: boolean | null;
    location: string;
  }[];
  viewsByDay: { date: string; count: number }[];
  viewerDetails: {
    viewerKey: string;
    viewer: string;
    sessions: number;
    totalDuration: number;
    avgSessionDuration: number;
    completionRate: number;
    lastViewedAt: string;
    location: string;
  }[];
  pageTiming: { page: number; avgDuration: number; views: number }[];
  locationStats: { location: string; count: number; percentage: number }[];
}

const ACCESS_LEVEL_LABELS: Record<DeckShareLink["access_level"], string> = {
  public: "Public",
  restricted: "Restricted",
  whitelisted: "Whitelisted",
};

const EXPIRATION_OPTIONS = ["7", "30", "90", "180", "365"];
const ANALYTICS_ACCENT = "#771144";
const ANALYTICS_ACCENT_RGB = "119,17,68";
const ANALYTICS_ACCENT_LIGHT = "#f7d3e6";

export default function DeckPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<DeckFile[]>([]);
  const [shareLinks, setShareLinks] = useState<DeckShareLink[]>([]);
  const [shareDeckFilter, setShareDeckFilter] = useState("");
  const [analyticsToken, setAnalyticsToken] = useState<string>("");
  const [analyticsData, setAnalyticsData] =
    useState<DeckAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [recentShareLink, setRecentShareLink] = useState<{
    token: string;
    url: string;
    deckId: string;
  } | null>(null);
  const [copyHintVisible, setCopyHintVisible] = useState(false);
  const copyHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingIdentifier, setEditingIdentifier] = useState<string | null>(
    null,
  );
  const [identifierValue, setIdentifierValue] = useState("");
  const [updatingIdentifier, setUpdatingIdentifier] = useState<string | null>(
    null,
  );
  const [linkForm, setLinkForm] = useState({
    accessLevel: "restricted",
    expirationDays: "30",
    recipientEmail: "",
    allowedEmails: "",
    allowedDomains: "",
    isDownloadable: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareLinkBase = appOrigin || "your-domain.com";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyHintTimeoutRef.current) {
        clearTimeout(copyHintTimeoutRef.current);
      }
    };
  }, []);

  const buildShareUrl = useCallback(
    (token: string, identifier: string | null = null) => {
      if (!token) return "";
      const origin =
        appOrigin ||
        (typeof window !== "undefined" ? window.location.origin : "");
      if (!origin) return "";

      // Use format: /[identifier]/view?token=[token] when identifier is available
      // Fallback to /view?token=[token] when identifier is not available
      if (identifier) {
        return `${origin}/${encodeURIComponent(identifier)}/view?token=${token}`;
      }
      return `${origin}/view?token=${token}`;
    },
    [appOrigin],
  );

  const hideCopyHint = useCallback(() => {
    if (copyHintTimeoutRef.current) {
      clearTimeout(copyHintTimeoutRef.current);
      copyHintTimeoutRef.current = null;
    }
    setCopyHintVisible(false);
  }, []);

  const triggerCopyHint = useCallback(() => {
    if (copyHintTimeoutRef.current) {
      clearTimeout(copyHintTimeoutRef.current);
    }
    setCopyHintVisible(true);
    copyHintTimeoutRef.current = setTimeout(() => {
      setCopyHintVisible(false);
      copyHintTimeoutRef.current = null;
    }, 8000);
  }, []);

  const handlePopupLogin = async () => {
    if (loginLoading) return;
    try {
      setLoginError("");
      setLoginLoading(true);
      const supabase = createClient();
      const redirectUrl = new URL("/auth/callback", window.location.origin);
      redirectUrl.searchParams.set("next", "/deck");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });
      if (error) {
        setLoginError(error.message);
        setLoginLoading(false);
      }
    } catch {
      setLoginError("Unable to start Google login right now.");
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const verifyAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error || !currentUser) {
          setShowLogin(true);
          setUser(null);
          return;
        }

        setUser(currentUser);
        setShowLogin(false);
        setLoginError("");
      } catch (error) {
        console.error("Auth error:", error);
        setShowLogin(true);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    verifyAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const getDeckName = useCallback((filePath: string) => {
    if (!filePath) return "Untitled Deck";
    const fileName = filePath.split("/").pop() || "";
    const withoutExtension = fileName.replace(/\.[^.]+$/, "");
    const withoutTimestamp = withoutExtension.replace(/_\d{6,}$/, "");
    const cleaned = withoutTimestamp
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) {
      return "Untitled Deck";
    }
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) return "Unknown";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const loadDecks = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/deck/list");
      const data = await response.json();

      if (response.ok) {
        const fetchedDecks: DeckFile[] = data.deckFiles || [];
        setDecks(fetchedDecks);
        setSelectedDeckId((prev) => {
          if (prev && fetchedDecks.some((deck) => deck.id === prev)) {
            return prev;
          }
          return fetchedDecks[0]?.id || "";
        });
      } else {
        toast.error(data.error || "Failed to load decks");
      }
    } catch (error) {
      console.error("Error loading decks:", error);
      toast.error("Failed to load decks");
    }
  }, [user]);

  const loadShareLinks = useCallback(
    async (deckId?: string) => {
      if (!user) return;

      try {
        setShareLoading(true);
        const search = deckId ? `?deckId=${deckId}` : "";
        const response = await fetch(`/api/deck/share${search}`);
        const data = await response.json();

        if (response.ok) {
          setShareLinks(data.shareLinks || []);
        } else {
          toast.error(data.error || "Failed to load share links");
        }
      } catch (error) {
        console.error("Error loading share links:", error);
      } finally {
        setShareLoading(false);
      }
    },
    [user],
  );

  const loadAnalytics = useCallback(async (token: string) => {
    if (!token) return;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await fetch(`/api/analytics/deck?token=${token}`);
      const data = await response.json();
      if (response.ok) {
        setAnalyticsData(data as DeckAnalyticsResponse);
      } else {
        setAnalyticsError(data.error || "Failed to load analytics");
        setAnalyticsData(null);
      }
    } catch (error) {
      console.error("Analytics error:", error);
      setAnalyticsError("Failed to load analytics");
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDecks();
  }, [user, loadDecks]);

  useEffect(() => {
    if (!user) return;
    loadShareLinks(shareDeckFilter || undefined);
  }, [user, shareDeckFilter, loadShareLinks]);

  const uploadDeckFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setUploading(true);
    try {
      const prepareResponse = await fetch("/api/deck/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deck",
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      const prepareData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        toast.error(prepareData.error || "Failed to prepare upload");
        return;
      }

      const { signedUrl, storagePath } = prepareData as {
        signedUrl?: string;
        storagePath?: string;
      };

      if (!signedUrl || !storagePath) {
        toast.error("Invalid upload URL response");
        return;
      }

      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        toast.error("Failed to upload deck to storage");
        return;
      }

      const finalizeResponse = await fetch("/api/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deck", storagePath }),
      });

      const finalizeData = await finalizeResponse.json();

      if (finalizeResponse.ok) {
        toast.success("Deck uploaded successfully!");
        await loadDecks();
      } else {
        toast.error(finalizeData.error || "Failed to finalize deck upload");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload deck");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDeckFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadDeckFile(file);
    }
  };

  const handleDelete = async (deckId: string) => {
    if (
      !confirm(
        "Delete this deck? All associated share links will also be removed.",
      )
    ) {
      return;
    }

    setDeleting(deckId);
    try {
      const response = await fetch(`/api/deck/delete?deckId=${deckId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Deck deleted successfully");
        await loadDecks();
        await loadShareLinks(shareDeckFilter || undefined);
      } else {
        toast.error(data.error || "Failed to delete deck");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete deck");
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async (deckId: string) => {
    if (!renameValue.trim()) {
      toast.error("Please enter a name");
      return;
    }

    setRenaming(deckId);
    try {
      const response = await fetch("/api/deck/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, newName: renameValue }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Deck renamed successfully");
        setRenaming(null);
        setRenameValue("");
        await loadDecks();
      } else {
        toast.error(data.error || "Failed to rename deck");
      }
    } catch (error) {
      console.error("Rename error:", error);
      toast.error("Failed to rename deck");
    } finally {
      setRenaming(null);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setDecks([]);
    setShareLinks([]);
    setSelectedDeckId("");
    setShowLogin(true);
    router.push("/");
  };

  const handleGenerateLink = async () => {
    if (!selectedDeckId) {
      toast.error("Select a deck to share");
      return;
    }
    if (
      linkForm.accessLevel === "whitelisted" &&
      !linkForm.recipientEmail.trim()
    ) {
      toast.error("Recipient email is required for whitelisted links");
      return;
    }

    setCreatingLink(true);
    try {
      const allowedEmails = linkForm.allowedEmails
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
      const allowedDomains = linkForm.allowedDomains
        .split(",")
        .map((domain) => domain.trim())
        .filter(Boolean);

      const response = await fetch("/api/deck/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: selectedDeckId,
          access_level: linkForm.accessLevel,
          recipient_email: linkForm.recipientEmail.trim() || null,
          allowed_emails: allowedEmails.length ? allowedEmails : null,
          allowed_domains: allowedDomains.length ? allowedDomains : null,
          expiration_days: linkForm.expirationDays,
          is_downloadable: linkForm.isDownloadable,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Share link created");
        const token = data?.shareLink?.token as string | undefined;
        const resolvedShareUrl =
          (data?.share_url as string | undefined) ||
          (token ? buildShareUrl(token) : "");

        if (token && resolvedShareUrl) {
          const identifier = data?.shareLink?.link_identifier || null;
          const fullUrl = buildShareUrl(token, identifier);
          setRecentShareLink({
            token,
            url: fullUrl || resolvedShareUrl,
            deckId: selectedDeckId,
          });
          triggerCopyHint();
        }

        await loadShareLinks(shareDeckFilter || undefined);
        setLinkForm((prev) => ({
          ...prev,
          allowedDomains: "",
          allowedEmails: "",
          recipientEmail: "",
        }));
      } else {
        toast.error(data.error || "Failed to create share link");
      }
    } catch (error) {
      console.error("Share link error:", error);
      toast.error("Failed to create share link");
    } finally {
      setCreatingLink(false);
    }
  };

  const copyShareLink = async (url: string) => {
    if (!url) {
      toast.error("Unable to copy link");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleCopyLink = async (
    token: string,
    identifier: string | null = null,
  ) => {
    await copyShareLink(buildShareUrl(token, identifier));
  };

  const handleUpdateIdentifier = async (token: string) => {
    if (!identifierValue.trim()) {
      toast.error("Identifier cannot be empty");
      return;
    }

    setUpdatingIdentifier(token);
    try {
      const response = await fetch("/api/deck/share/update-identifier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          identifier: identifierValue.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Link identifier updated");
        setEditingIdentifier(null);
        setIdentifierValue("");
        await loadShareLinks(shareDeckFilter || undefined);
      } else {
        toast.error(data.error || "Failed to update identifier");
      }
    } catch (error) {
      console.error("Update identifier error:", error);
      toast.error("Failed to update identifier");
    } finally {
      setUpdatingIdentifier(null);
    }
  };

  const handleCopyLatestLink = async () => {
    if (!recentShareLink?.url) {
      toast.error("No link ready to copy yet");
      return;
    }
    await copyShareLink(recentShareLink.url);
    hideCopyHint();
  };

  const handleShareFilterChange = (deckId: string) => {
    setShareDeckFilter(deckId);
  };

  const handleRevokeLink = async (token: string) => {
    setRevokingToken(token);
    try {
      const response = await fetch(`/api/deck/share?token=${token}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.ok) {
        toast.success("Share link revoked");
        await loadShareLinks(shareDeckFilter || undefined);
      } else {
        toast.error(data.error || "Failed to revoke share link");
      }
    } catch (error) {
      console.error("Revoke error:", error);
      toast.error("Failed to revoke share link");
    } finally {
      setRevokingToken(null);
    }
  };

  const handleViewAnalytics = (token: string) => {
    setAnalyticsToken(token);
    loadAnalytics(token);
  };

  const deckNameMap = useMemo(() => {
    const map = new Map<string, string>();
    decks.forEach((deck) => map.set(deck.id, getDeckName(deck.file_path)));
    return map;
  }, [decks, getDeckName]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) || null,
    [decks, selectedDeckId],
  );

  const stats = useMemo(() => {
    const latestDeck = decks[0];
    const upcomingExpiry = shareLinks.reduce<string | null>((soonest, link) => {
      if (!link.expires_at) return soonest;
      if (!soonest) return link.expires_at;
      return new Date(link.expires_at) < new Date(soonest)
        ? link.expires_at
        : soonest;
    }, null);

    return [
      {
        label: "Decks",
        value: decks.length,
        icon: UploadCloud,
      },
      {
        label: "Share Links",
        value: shareLinks.length,
        icon: Share2,
      },
      {
        label: "Last Upload",
        value: latestDeck ? formatDate(latestDeck.uploaded_at) : "N/A",
        icon: Sparkles,
      },
      {
        label: "Next Expiry",
        value: upcomingExpiry ? formatDate(upcomingExpiry) : "None",
        icon: Clock4,
      },
    ];
  }, [decks, shareLinks, formatDate]);

  const formatDurationSeconds = (seconds: number) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9f5fb] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#771144]" />
      </div>
    );
  }

  return (
    <>
      <div
        className={`min-h-screen bg-[#f9f5fb] text-slate-900 ${
          showLogin && !user ? "pointer-events-none blur-sm" : ""
        }`}
      >
        <div className="relative isolate bg-[#f9f5fb] border-b border-slate-200">
          <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                  RaiseGate Deck Share
                </p>
                <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
                  Share your deck with investors and track exactly how they
                  engage with it.
                </h1>
                <p className="mt-3 text-slate-600 max-w-2xl">
                  Upload polished decks, generate tamper-proof sharing links,
                  and control your narrative with download and verification
                  controls.
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                {user ? (
                  <>
                    <span>{user.email}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 text-slate-800 hover:bg-slate-200"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300 text-slate-800 hover:bg-slate-200"
                    onClick={() => setShowLogin(true)}
                  >
                    Sign in
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <stat.icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <p className="mt-4 text-xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 space-y-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="bg-white border-slate-200">
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-slate-800" />
                  Upload Deck
                </CardTitle>
                <CardDescription>
                  Drop a PDF to deploy it directly into RaiseGate (max 20MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center transition hover:border-slate-400 hover:bg-slate-100 cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-slate-200">
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                      ) : (
                        <UploadCloud className="w-6 h-6 text-slate-800" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {uploading
                          ? "Uploading your deck..."
                          : "Click or drop a PDF"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {uploading
                          ? "Hang tight while we secure your file"
                          : "AES encrypted upload • unlimited revisions"}
                      </p>
                    </div>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileInputChange}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Shield className="w-5 h-5 text-slate-800" />
                  Generate Secure Link
                </CardTitle>
                <CardDescription>
                  Choose your deck, tailor access, and issue a branded share
                  link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-slate-600 flex flex-col gap-2">
                  <label htmlFor="deckSelect">Deck to share</label>
                  <select
                    id="deckSelect"
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900"
                  >
                    <option value="">Select deck</option>
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {getDeckName(deck.file_path)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDeck ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                    {renaming === selectedDeck.id ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="bg-white border-slate-300 text-slate-900"
                          placeholder="Enter new name"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-[#771144] text-white hover:bg-[#5d0d36]"
                            onClick={() => handleRename(selectedDeck.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-300 text-slate-800"
                            onClick={() => {
                              setRenaming(null);
                              setRenameValue("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {getDeckName(selectedDeck.file_path)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Uploaded {formatDate(selectedDeck.uploaded_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-800 hover:bg-white"
                            onClick={() => {
                              setRenameValue(
                                getDeckName(selectedDeck.file_path),
                              );
                              setRenaming(selectedDeck.id);
                            }}
                          >
                            <PenSquare className="w-4 h-4 mr-1" />
                            Rename
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-400 hover:bg-rose-500/10"
                            onClick={() => handleDelete(selectedDeck.id)}
                            disabled={deleting === selectedDeck.id}
                          >
                            {deleting === selectedDeck.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-1" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Upload a deck to unlock sharing controls.
                  </p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="text-sm text-slate-600 flex flex-col gap-2">
                    <label htmlFor="accessLevel">Access level</label>
                    <select
                      id="accessLevel"
                      value={linkForm.accessLevel}
                      onChange={(e) =>
                        setLinkForm((prev) => ({
                          ...prev,
                          accessLevel: e.target.value,
                        }))
                      }
                      className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900"
                    >
                      <option value="restricted">
                        Restricted (magic link)
                      </option>
                      <option value="public">Public</option>
                      <option value="whitelisted">Whitelisted email</option>
                    </select>
                  </div>
                  <div className="text-sm text-slate-600 flex flex-col gap-2">
                    <label htmlFor="expiration">Expires in</label>
                    <select
                      id="expiration"
                      value={linkForm.expirationDays}
                      onChange={(e) =>
                        setLinkForm((prev) => ({
                          ...prev,
                          expirationDays: e.target.value,
                        }))
                      }
                      className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900"
                    >
                      {EXPIRATION_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {day} days
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {linkForm.accessLevel === "whitelisted" && (
                  <div className="space-y-3">
                    <Input
                      placeholder="Recipient email"
                      value={linkForm.recipientEmail}
                      onChange={(e) =>
                        setLinkForm((prev) => ({
                          ...prev,
                          recipientEmail: e.target.value,
                        }))
                      }
                      className="bg-white border-slate-300 text-slate-900"
                    />
                    <Input
                      placeholder="Allowed emails (comma separated)"
                      value={linkForm.allowedEmails}
                      onChange={(e) =>
                        setLinkForm((prev) => ({
                          ...prev,
                          allowedEmails: e.target.value,
                        }))
                      }
                      className="bg-white border-slate-300 text-slate-900"
                    />
                    <Input
                      placeholder="Allowed domains (comma separated)"
                      value={linkForm.allowedDomains}
                      onChange={(e) =>
                        setLinkForm((prev) => ({
                          ...prev,
                          allowedDomains: e.target.value,
                        }))
                      }
                      className="bg-white border-slate-300 text-slate-900"
                    />
                  </div>
                )}

                <label className="flex items-center gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={linkForm.isDownloadable}
                    onChange={(e) =>
                      setLinkForm((prev) => ({
                        ...prev,
                        isDownloadable: e.target.checked,
                      }))
                    }
                    className="form-checkbox h-4 w-4 rounded border-slate-300 bg-white text-slate-900 focus:ring-slate-500"
                  />
                  Allow download access
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="w-full gap-2 bg-[#771144] text-white hover:bg-[#5d0d36]"
                    onClick={handleGenerateLink}
                    disabled={creatingLink}
                  >
                    {creatingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Generate secure link
                      </>
                    )}
                  </Button>
                  {recentShareLink && copyHintVisible && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 border-slate-300 text-slate-800 hover:bg-slate-200/70 sm:w-auto"
                      onClick={handleCopyLatestLink}
                    >
                      <Copy className="w-4 h-4" />
                      Copy latest link
                    </Button>
                  )}
                </div>
                {recentShareLink && copyHintVisible && (
                  <p className="text-xs text-slate-500">
                    Latest link ready for{" "}
                    {deckNameMap.get(recentShareLink.deckId) || "your deck"}.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="bg-white border-slate-200 lg:col-span-2">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-slate-800" />
                      Active Share Links
                    </CardTitle>
                    <CardDescription>
                      Rotate, revoke, or copy trackable links
                    </CardDescription>
                  </div>
                  <div className="text-sm text-slate-600 flex flex-col gap-1">
                    <label
                      htmlFor="shareDeckFilter"
                      className="text-xs uppercase tracking-wide text-slate-500"
                    >
                      Filter by deck
                    </label>
                    <select
                      id="shareDeckFilter"
                      value={shareDeckFilter}
                      onChange={(e) => handleShareFilterChange(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900"
                    >
                      <option value="">All decks</option>
                      {decks.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {getDeckName(deck.file_path)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {shareLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                  </div>
                ) : shareLinks.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">
                    {shareDeckFilter
                      ? "No share links for this deck yet."
                      : "No share links yet. Generate one to get started."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shareLinks.map((link) => {
                      const isEditing = editingIdentifier === link.token;
                      const trimmedIdentifier = identifierValue.trim();
                      const previewIdentifier = isEditing
                        ? trimmedIdentifier || link.link_identifier || ""
                        : link.link_identifier || "";
                      const previewUrl = buildShareUrl(
                        link.token,
                        previewIdentifier ? previewIdentifier : null,
                      );
                      const customUrl = buildShareUrl(
                        link.token,
                        link.link_identifier,
                      );

                      return (
                        <div
                          key={link.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-start gap-3 justify-between">
                            <div>
                              <p className="text-sm uppercase tracking-widest text-slate-500">
                                {deckNameMap.get(link.deck_id) || "Deck"}
                              </p>
                              <p className="text-base font-semibold">
                                {ACCESS_LEVEL_LABELS[link.access_level]}
                              </p>
                              <p className="text-xs text-slate-500">
                                Created {formatDate(link.created_at)} •{" "}
                                {link.expires_at
                                  ? `Expires ${formatDate(link.expires_at)}`
                                  : "No expiry"}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-[#771144]/10 px-3 py-1 text-xs text-[#771144]">
                              <ShieldCheck className="w-3 h-3" />
                              {link.is_downloadable
                                ? "Downloadable"
                                : "View only"}
                            </span>
                          </div>
                          {isEditing ? (
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                                <div>
                                  <p className="text-sm font-semibold">
                                    Custom share link
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    This is the part of the link your recipients
                                    will see. Keep it short and recognizable.
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 font-mono text-sm text-slate-600">
                                  <span className="text-slate-500">
                                    {shareLinkBase}/
                                  </span>
                                  <Input
                                    value={identifierValue}
                                    onChange={(e) =>
                                      setIdentifierValue(e.target.value)
                                    }
                                    className="flex-1 min-w-[160px] bg-white border-slate-300 text-slate-900 font-mono"
                                    placeholder="custom-link"
                                    autoFocus
                                  />
                                  <span className="text-slate-500">/view</span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  We’ll automatically append the secure token so
                                  the link stays protected.
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                                <p className="text-[11px] uppercase tracking-widest text-slate-500">
                                  Preview
                                </p>
                                {previewIdentifier ? (
                                  <p className="mt-1 font-mono text-sm text-slate-900 break-all">
                                    {previewUrl}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Add a custom name above to see the full link
                                    format.
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="bg-white text-[#771144] hover:bg-slate-100"
                                  onClick={() =>
                                    handleUpdateIdentifier(link.token)
                                  }
                                  disabled={updatingIdentifier === link.token}
                                >
                                  {updatingIdentifier === link.token ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-300 text-slate-800"
                                  onClick={() => {
                                    setEditingIdentifier(null);
                                    setIdentifierValue("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {link.link_identifier ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/30 p-3 space-y-1">
                                  <p className="text-xs uppercase tracking-widest text-slate-500">
                                    Custom link
                                  </p>
                                  <p className="font-mono text-sm text-slate-900 break-all">
                                    {customUrl}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    This friendly path routes to the same secure
                                    link and is easier to share.
                                  </p>
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/20 p-3">
                                  <p className="text-xs text-slate-500">
                                    Add a custom link handle to replace the
                                    default tokenized URL.
                                  </p>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-slate-300 text-slate-800 hover:bg-slate-200"
                                  onClick={() =>
                                    handleViewAnalytics(link.token)
                                  }
                                >
                                  {analyticsToken === link.token &&
                                  analyticsLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  ) : (
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                  )}
                                  Analytics
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-slate-300 text-slate-800 hover:bg-slate-200"
                                  onClick={() => {
                                    setIdentifierValue(
                                      link.link_identifier || "",
                                    );
                                    setEditingIdentifier(link.token);
                                  }}
                                >
                                  <Link2 className="w-4 h-4 mr-2" />
                                  Edit Link
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-slate-300 text-slate-800 hover:bg-slate-200"
                                  onClick={() =>
                                    handleCopyLink(
                                      link.token,
                                      link.link_identifier,
                                    )
                                  }
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy Link
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-400 hover:bg-rose-500/10"
                                  onClick={() => handleRevokeLink(link.token)}
                                  disabled={revokingToken === link.token}
                                >
                                  {revokingToken === link.token ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                  <span className="ml-2">Revoke</span>
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-slate-200">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-800" />
                Deck Analytics
              </CardTitle>
              <CardDescription>
                Select any share link to visualize verified viewer engagement.
              </CardDescription>
              {analyticsToken && (
                <p className="text-xs text-slate-500">
                  Viewing analytics for token{" "}
                  <span className="font-mono">
                    {analyticsToken.slice(0, 10)}…
                  </span>
                </p>
              )}
            </CardHeader>
            <CardContent>
              {analyticsError && (
                <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {analyticsError}
                </div>
              )}
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                </div>
              ) : !analyticsToken ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  Tap “Analytics” on any share link to populate this panel.
                </div>
              ) : analyticsData ? (
                <div className="space-y-8">
                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      {
                        label: "Total Views",
                        value: analyticsData.summary.totalViews,
                        icon: Eye,
                      },
                      {
                        label: "Unique Viewers",
                        value: analyticsData.summary.uniqueViewers,
                        icon: Users,
                      },
                      {
                        label: "Avg. Duration",
                        value: formatDurationSeconds(
                          analyticsData.summary.avgDuration,
                        ),
                        icon: Clock4,
                      },
                      {
                        label: "Completion Rate",
                        value: `${analyticsData.summary.completionRate}%`,
                        icon: ShieldCheck,
                      },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
                          <span>{metric.label}</span>
                          <metric.icon className="w-4 h-4 text-slate-500" />
                        </div>
                        <p className="mt-3 text-xl font-semibold">
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
                      <p className="text-sm font-semibold text-slate-800 mb-3">
                        Views Over Time
                      </p>
                      {analyticsData.viewsByDay.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No timeline data yet.
                        </p>
                      ) : (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analyticsData.viewsByDay}>
                              <defs>
                                <linearGradient
                                  id="viewsGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor={ANALYTICS_ACCENT_LIGHT}
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor={ANALYTICS_ACCENT_LIGHT}
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={`rgba(${ANALYTICS_ACCENT_RGB},0.15)`}
                              />
                              <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                fontSize={12}
                              />
                              <YAxis stroke="#94a3b8" fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "rgba(15,23,42,0.9)",
                                  border: "1px solid rgba(148,163,184,0.2)",
                                  borderRadius: "0.75rem",
                                  color: "white",
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="count"
                                stroke={ANALYTICS_ACCENT}
                                fillOpacity={0.8}
                                fill="url(#viewsGradient)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
                      <p className="text-sm font-semibold text-slate-800 mb-3">
                        Hot Pages
                      </p>
                      {analyticsData.pageEngagement.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Waiting for viewers to flip through.
                        </p>
                      ) : (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={analyticsData.pageEngagement.slice(0, 6)}
                              layout="vertical"
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={`rgba(${ANALYTICS_ACCENT_RGB},0.15)`}
                              />
                              <XAxis
                                type="number"
                                stroke="#94a3b8"
                                fontSize={12}
                              />
                              <YAxis
                                type="category"
                                dataKey={(entry) => `Page ${entry.page}`}
                                width={70}
                                stroke="#94a3b8"
                                fontSize={12}
                              />
                              <Tooltip
                                cursor={{
                                  fill: `rgba(${ANALYTICS_ACCENT_RGB},0.08)`,
                                }}
                                contentStyle={{
                                  backgroundColor: "rgba(15,23,42,0.9)",
                                  border: "1px solid rgba(148,163,184,0.2)",
                                  borderRadius: "0.75rem",
                                  color: "white",
                                }}
                              />
                              <Bar dataKey="views" radius={[0, 10, 10, 0]}>
                                {analyticsData.pageEngagement
                                  .slice(0, 6)
                                  .map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={`rgba(${ANALYTICS_ACCENT_RGB},${
                                        0.6 - index * 0.08
                                      })`}
                                    />
                                  ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">
                      Recent Sessions
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-slate-800">
                        <thead>
                          <tr className="text-xs uppercase tracking-wide text-slate-500">
                            <th className="py-2 text-left">Viewer</th>
                            <th className="py-2 text-left">Location</th>
                            <th className="py-2 text-left">Duration</th>
                            <th className="py-2 text-left">Pages</th>
                            <th className="py-2 text-left">Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.recentViewers
                            .slice(0, 6)
                            .map((viewer) => (
                              <tr
                                key={viewer.id}
                                className="border-t border-slate-200/70"
                              >
                                <td className="py-2">{viewer.viewer}</td>
                                <td className="py-2 text-slate-500">
                                  {viewer.location}
                                </td>
                                <td className="py-2">
                                  {formatDurationSeconds(viewer.duration || 0)}
                                </td>
                                <td className="py-2 text-slate-500">
                                  {viewer.pagesViewed}
                                </td>
                                <td className="py-2">
                                  {viewer.completed ? (
                                    <span className="text-emerald-400">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">No</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          {analyticsData.recentViewers.length === 0 && (
                            <tr>
                              <td
                                className="py-4 text-center text-slate-500"
                                colSpan={5}
                              >
                                No sessions recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  Analytics unavailable. Try loading a different link.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center bg-white/80 text-2xl font-semibold text-slate-400 shadow-sm transition hover:text-slate-600"
              onClick={() => {
                setShowLogin(false);
                setLoginError("");
              }}
              aria-label="Close popup"
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6 p-6 sm:p-10">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                    Deck workspace
                  </p>
                  <p className="text-3xl font-semibold text-slate-900">
                    Sign in with Google to manage RaiseGate decks.
                  </p>
                  <p className="text-sm text-slate-600">
                    One secure login unlocks uploads, investor links, and live
                    engagement timelines.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">
                    From this workspace you can:
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>• Upload watermarked PDFs.</li>
                    <li>• Issue invite-only share links.</li>
                    <li>• Track every slide view in real time.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={handlePopupLogin}
                  disabled={loginLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-slate-950/5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#771144] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-[#771144]" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white">
                        <GoogleIcon />
                      </span>
                      Sign in with Google
                    </>
                  )}
                </button>
                {loginError && (
                  <p className="text-center text-sm text-rose-500">
                    {loginError}
                  </p>
                )}
                <p className="text-center text-xs text-slate-500">
                  RaiseGate never sees your password—Google verifies every
                  session.
                </p>
              </div>
              <div className="relative hidden flex-col justify-between border-l border-slate-100 bg-slate-50 p-10 text-slate-900 md:flex">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    RaiseGate in practice
                  </p>
                  <p className="text-2xl font-semibold leading-snug">
                    Protect every deck and know who’s reading.
                  </p>
                  <p className="text-sm text-slate-600">
                    Download locks, whitelisted invites, and analytics pulse
                    through a single login.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                      Decks launched
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[#771144]">
                      480+
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                      Investor replies
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[#771144]">
                      92
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                  “RaiseGate keeps our live deck links locked down and pings us
                  the moment an investor re-opens diligence slides.”
                  <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-slate-500">
                    HELENA · ASTERIA VENTURES
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
