"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleIcon } from "@/components/google-icon";
import {
  Activity,
  BarChart3,
  Copy,
  Eye,
  LineChart,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  Clock4,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const heroHighlights = [
  {
    title: "Secure uploads",
    description: "20MB PDFs • automatic watermarking • encryption at rest.",
    icon: UploadCloud,
  },
  {
    title: "Branded share links",
    description: "Custom URLs, expiration controls, and viewer verification.",
    icon: Copy,
  },
  {
    title: "Engagement analytics",
    description:
      "Slide-by-slide attention, completion rate, and drop-off alerts.",
    icon: BarChart3,
  },
];

const featureCards = [
  {
    title: "Upload once, stay in sync.",
    description:
      "Swap updated decks without issuing a new URL. Investors always see the latest version.",
    icon: UploadCloud,
  },
  {
    title: "Control every access point.",
    description:
      "Grant downloads, revoke views, or require logins per investor group in seconds.",
    icon: ShieldCheck,
  },
  {
    title: "Prove interest with data.",
    description:
      "Share precise engagement summaries with partners to keep diligence on track.",
    icon: BarChart3,
  },
];

const workflowSteps = [
  "Drop your PDF into RaiseGate Deck Sharing.",
  "Customize the share link: identifier, expiry, download rules.",
  "Send and monitor live analytics to inform follow-ups.",
];

const analyticsMetrics = [
  { label: "Total deck views", value: "482" },
  { label: "Unique investors", value: "91" },
  { label: "Avg. session time", value: "5m 44s" },
  { label: "Completion rate", value: "76%" },
];

const viewerTrendData = [
  { day: "Mon", views: 34, verified: 18 },
  { day: "Tue", views: 48, verified: 25 },
  { day: "Wed", views: 56, verified: 32 },
  { day: "Thu", views: 61, verified: 38 },
  { day: "Fri", views: 74, verified: 41 },
  { day: "Sat", views: 69, verified: 37 },
  { day: "Sun", views: 82, verified: 44 },
];

const slideAttentionData = [
  { page: "Intro", seconds: 52 },
  { page: "Team", seconds: 64 },
  { page: "Product", seconds: 77 },
  { page: "Go-To-Market", seconds: 59 },
  { page: "Financials", seconds: 71 },
  { page: "Ask", seconds: 48 },
];

const liveShareLinks = [
  {
    id: "helena",
    deck: "Raise Series A",
    status: "Tracking",
    viewers: 18,
    completion: 72,
  },
  {
    id: "summit",
    deck: "Platform Vision",
    status: "Expiring in 48h",
    viewers: 11,
    completion: 63,
  },
  {
    id: "northwood",
    deck: "Infra Update",
    status: "Download locked",
    viewers: 7,
    completion: 81,
  },
];

const investorSignals = [
  {
    firm: "Northwood Capital",
    action: "Replayed slides 11-14",
    minutesAgo: 6,
    heat: 82,
  },
  {
    firm: "Signal Peak",
    action: "Forwarded link with download off",
    minutesAgo: 19,
    heat: 64,
  },
  {
    firm: "Asteria Ventures",
    action: "Completed deck twice this week",
    minutesAgo: 43,
    heat: 91,
  },
];

export default function HomePageClient() {
  const [showLogin, setShowLogin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

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
    if (!showLogin) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowLogin(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showLogin]);

  return (
    <div className="min-h-screen bg-[#f9f5fb] text-slate-900">
      <header
        className="relative overflow-hidden text-white"
        style={{
          backgroundColor: "#771144",
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%), linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%)",
          backgroundSize: "50px 50px",
        }}
      >
        <div className="absolute inset-y-0 right-0 w-1/2 bg-white/10 blur-[160px]" />
        <div className="relative container mx-auto px-6 py-6 sm:py-10 lg:py-12">
          <nav className="flex flex-wrap items-center justify-between gap-4 text-sm font-medium text-white/80">
            <div className="flex items-center gap-3">
              <Image
                src="https://qxglmugxqulsuivbckcm.supabase.co/storage/v1/object/public/rgstuff//rglogo-removebg-preview.png"
                alt="RaiseGate logo"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
                priority
              />
              <span className="text-base font-semibold tracking-wide">
                RaiseGate
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="#features" className="hover:text-white">
                Deck sharing
              </Link>
              <Link href="#analytics" className="hover:text-white">
                Analytics
              </Link>
              <Link href="#workflow" className="hover:text-white">
                Workflow
              </Link>
              <Button
                asChild
                variant="outline"
                className="cursor-pointer border-white/50 bg-white/10 text-white hover:bg-white/20"
              >
                <Link
                  href="https://cal.com/yash-3f/15min"
                  target="_blank"
                  rel="noreferrer"
                >
                  Book a demo
                </Link>
              </Button>
              <button
                className="cursor-pointer text-sm font-medium hover:text-white"
                onClick={() => setShowLogin(true)}
              >
                Login
              </button>
            </div>
          </nav>
        </div>

        <div className="relative container mx-auto px-6 pb-16 pt-6 sm:pb-20 lg:pb-24">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">
                Deck sharing
              </p>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
                  Launch investor-ready decks in minutes.
                </h1>
                <p className="text-base text-white/80 sm:text-lg">
                  RaiseGate Deck Sharing helps founders upload polished PDFs,
                  issue tamper-proof links, and control every access point—all
                  with intelligence baked in.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button
                  className="cursor-pointer bg-white text-[#771144] hover:bg-slate-100"
                  onClick={() => setShowLogin(true)}
                >
                  Start for free
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="cursor-pointer border-white/60 text-white hover:bg-white/10"
                >
                  <Link
                    href="https://cal.com/yash-3f/15min"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Book a walkthrough
                  </Link>
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {heroHighlights.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/30 bg-white/10 p-4"
                  >
                    <item.icon className="w-5 h-5 text-white" />
                    <p className="mt-2 text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-white/70">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative grid gap-4">
              <Card className="border-white/20 bg-white/95 text-slate-900 shadow-2xl">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Deck preview
                      </p>
                      <p className="text-lg font-semibold">Raise Series A</p>
                    </div>
                    <span className="rounded-full bg-[#771144]/10 px-3 py-1 text-xs text-[#771144]">
                      Ready
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Share link
                    </p>
                    <p className="font-mono text-sm text-slate-700">
                      raisegate.com/helena/view?token=•••
                    </p>
                    <p className="text-xs text-slate-500">
                      Custom identifier enabled • Downloads off
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Unique viewers</p>
                      <p className="text-xl font-semibold">18</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Avg. completion</p>
                      <p className="text-xl font-semibold">72%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/20 backdrop-blur-xl text-white shadow-2xl">
                <CardContent className="p-6 space-y-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                    Quick actions
                  </p>
                  <div className="space-y-2 text-sm">
                    <p>• Create new investor link</p>
                    <p>• Toggle download permissions</p>
                    <p>• Send analytics recap</p>
                  </div>
                  <Button
                    className="cursor-pointer w-full bg-white text-[#771144] hover:bg-slate-100"
                    onClick={() => setShowLogin(true)}
                  >
                    Open Deck Sharing
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16 space-y-16">
        <section id="features" className="grid gap-8 lg:grid-cols-3">
          {featureCards.map((card) => (
            <Card key={card.title} className="border-slate-200 bg-white">
              <CardContent className="p-6 space-y-4">
                <card.icon className="w-6 h-6 text-[#771144]" />
                <p className="text-xl font-semibold">{card.title}</p>
                <p className="text-sm text-slate-600">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="dashboard" className="grid gap-8 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-slate-500">
                    <LineChart className="h-4 w-4 text-[#771144]" />
                    Live dashboard
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    Exactly what teams monitor inside RaiseGate.
                  </p>
                </div>
                <Button
                  className="cursor-pointer bg-[#771144] text-white hover:bg-[#5d0d36]"
                  onClick={() => setShowLogin(true)}
                >
                  Open dashboard
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Views today", value: "82", icon: Eye },
                  { label: "Verified viewers", value: "31", icon: Users },
                  { label: "Avg. duration", value: "5m 41s", icon: Clock4 },
                  { label: "Locked decks", value: "12", icon: ShieldCheck },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                      <span>{metric.label}</span>
                      <metric.icon className="h-4 w-4 text-slate-500" />
                    </div>
                    <p className="mt-3 text-xl font-semibold text-slate-900">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={viewerTrendData}>
                    <defs>
                      <linearGradient
                        id="liveViewsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#771144"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#771144"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="liveVerifiedGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#c084fc"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#c084fc"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
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
                      dataKey="verified"
                      stroke="#c084fc"
                      strokeWidth={2}
                      fill="url(#liveVerifiedGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#771144"
                      strokeWidth={3}
                      fill="url(#liveViewsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    Slide attention
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    Hold time per section (last 24h).
                  </p>
                </div>
                <span className="rounded-full bg-[#771144]/10 px-3 py-1 text-xs font-semibold text-[#771144]">
                  Real data
                </span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={slideAttentionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="page" stroke="#94a3b8" fontSize={12} />
                    <YAxis
                      dataKey="seconds"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickFormatter={(value) => `${value}s`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(119,17,68,0.05)" }}
                      contentStyle={{
                        backgroundColor: "rgba(15,23,42,0.9)",
                        border: "1px solid rgba(148,163,184,0.2)",
                        borderRadius: "0.75rem",
                        color: "white",
                      }}
                      formatter={(value: number) => [`${value}s`, "Hold time"]}
                    />
                    <Bar dataKey="seconds" radius={[6, 6, 0, 0]}>
                      {slideAttentionData.map((item, index) => (
                        <Cell
                          key={item.page}
                          fill={`rgba(119,17,68,${0.9 - index * 0.1})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    Active share links
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    Mirrors what your workspace tracks.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="cursor-pointer border-slate-300 text-slate-900 hover:bg-slate-100"
                  onClick={() => setShowLogin(true)}
                >
                  Sync decks
                </Button>
              </div>
              <div className="space-y-4">
                {liveShareLinks.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {link.deck}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-mono text-slate-500">
                          <Link2 className="h-3.5 w-3.5 text-[#771144]" />/
                          {link.id} • {link.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-slate-900">
                          {link.viewers}
                        </p>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                          Verified viewers
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-[#771144]"
                          style={{ width: `${link.completion}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {link.completion}% completion
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    Investor signals
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    Heat map of who&apos;s leaning in this week.
                  </p>
                </div>
                <Button
                  className="cursor-pointer bg-[#771144] text-white hover:bg-[#5d0d36]"
                  onClick={() => setShowLogin(true)}
                >
                  Open activity
                </Button>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                {investorSignals.map((signal) => (
                  <div
                    key={signal.firm}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {signal.firm}
                      </p>
                      <p>{signal.action}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500">
                        {signal.minutesAgo}m ago
                      </span>
                      <div className="mt-2 h-2 w-20 rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-[#771144]"
                          style={{ width: `${Math.min(signal.heat, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section
          id="analytics"
          className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-stretch"
        >
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                  Analytics
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  Understand which slides land—and where investors drop off.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {analyticsMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Eye className="mt-0.5 h-4 w-4 text-[#771144]" />
                  See real-time viewers and purge stale tokens instantly.
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="mt-0.5 h-4 w-4 text-[#771144]" />
                  Export slide-by-slide dwell time and completion events for
                  partner updates.
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 text-[#771144]" />
                  AI-assisted notes flag investors who skim versus those who dig
                  in.
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-6 space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Investor timeline
              </p>
              <div className="space-y-4">
                {[
                  { name: "Asteria Ventures", duration: "11m 12s", pages: 24 },
                  { name: "Northwood Capital", duration: "6m 30s", pages: 12 },
                  { name: "Signal Peak", duration: "8m 02s", pages: 19 },
                ].map((entry) => (
                  <div
                    key={entry.name}
                    className="rounded-2xl border border-white/60 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{entry.name}</p>
                      <span className="text-xs text-slate-500">
                        {entry.pages} pages
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Session length: {entry.duration}
                    </p>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#771144]"
                        style={{
                          width: `${Math.min(entry.pages * 4, 90)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="workflow">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                  Workflow
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  From PDF upload to investor-ready link.
                </p>
              </div>
              <ol className="grid gap-4 md:grid-cols-3">
                {workflowSteps.map((step, index) => (
                  <li
                    key={step}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
                  >
                    <span className="text-xs font-semibold text-[#771144]">
                      0{index + 1}
                    </span>
                    <p className="mt-2">{step}</p>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="cursor-pointer bg-[#771144] text-white hover:bg-[#5d0d36]"
                  onClick={() => setShowLogin(true)}
                >
                  Launch RaiseGate
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="cursor-pointer border-slate-300 text-slate-900 hover:bg-slate-100"
                >
                  <Link href="mailto:hello@raisegate.com">Contact sales</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border border-[#771144]/30 bg-[#1b0d16] px-8 py-10 text-white shadow-lg shadow-[#771144]/20">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">
                Live walkthroughs
              </p>
              <p className="text-3xl font-semibold">
                Book 15 minutes with Yash and see your data inside RaiseGate.
              </p>
              <p className="text-sm text-white/80">
                Every session uses the real deck workspace you&apos;ll access
                afterward—no slides, just product. Reserve a slot at{" "}
                <Link
                  href="https://cal.com/yash-3f/15min"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dashed underline-offset-4"
                >
                  cal.com/yash-3f/15min
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="cursor-pointer bg-white text-[#771144] hover:bg-slate-100"
              >
                <Link
                  href="https://cal.com/yash-3f/15min"
                  target="_blank"
                  rel="noreferrer"
                >
                  Book a 15-min demo
                </Link>
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer border-white/30 text-white hover:bg-white/10"
                onClick={() => setShowLogin(true)}
              >
                Launch dashboard
              </Button>
            </div>
          </div>
        </section>
      </main>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
            <button
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-2xl font-semibold text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:text-slate-600"
              onClick={() => setShowLogin(false)}
              aria-label="Close popup"
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6 p-6 sm:p-10">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                    Instant access
                  </p>
                  <p className="text-3xl font-semibold text-slate-900">
                    Sign in with Google and start sharing.
                  </p>
                  <p className="text-sm text-slate-600">
                    One click login. No passwords. Just your deck and real-time
                    activity.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">
                    One login unlocks:
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>• Branded links and invite controls.</li>
                    <li>• Watermarked PDFs with download guards.</li>
                    <li>• Live slide-by-slide engagement alerts.</li>
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
                      Sign up with Google
                    </>
                  )}
                </button>
                {loginError && (
                  <p className="text-center text-sm text-rose-500">
                    {loginError}
                  </p>
                )}
                <p className="text-center text-xs text-slate-500">
                  We only use your Google email to verify investor invites—no
                  spam, no surprise charges.
                </p>
              </div>
              <div className="relative hidden flex-col justify-between border-l border-slate-100 bg-slate-50 p-10 text-slate-900 md:flex">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    Why founders choose RaiseGate
                  </p>
                  <p className="text-2xl font-semibold leading-snug">
                    Secure sharing, instant read receipts.
                  </p>
                  <p className="text-sm text-slate-600">
                    Watermarks, download locks, and investor timelines are baked
                    in.
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
                  “We locked downloads, branded the link, and still saw exactly
                  when investors reopened our deck before every diligence call.”
                  <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-slate-500">
                    HELENA · ASTERIA VENTURES
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
