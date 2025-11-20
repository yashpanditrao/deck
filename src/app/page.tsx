'use client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Eye, Mail } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden font-sans">
      {/* Brand Strip */}
      <div className="w-full h-1.5 bg-[#771144]" />

      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#771144]/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#771144]/5 blur-[100px]" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">

          {/* Header Section */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 bg-[#771144]/10 rounded-xl mb-1 ring-1 ring-[#771144]/20 shadow-sm">
              <ShieldCheck className="w-8 h-8 text-[#771144]" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                RaiseGate <span className="text-[#771144]">Secure Viewer</span>
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto leading-relaxed">
                The secure platform for viewing shared pitch decks.
              </p>
            </div>
          </div>

          {/* Main Card */}
          <Card className="border-border/60 shadow-xl bg-card/80 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#771144]/0 via-[#771144]/50 to-[#771144]/0" />

            <CardHeader className="pb-3 pt-5 text-center border-b border-border/40 bg-muted/20">
              <CardTitle className="text-lg font-semibold">Accessing a Deck</CardTitle>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-6">
              <div className="space-y-5">
                <div className="flex items-start gap-3.5 group">
                  <div className="mt-0.5 bg-[#771144]/10 p-2 rounded-lg group-hover:bg-[#771144] group-hover:text-white transition-colors duration-300 shrink-0">
                    <Mail className="w-4 h-4 text-[#771144] group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-semibold text-sm text-foreground">1. Check your inbox</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                      The founder has sent you an email with a unique, secure access link.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 group">
                  <div className="mt-0.5 bg-[#771144]/10 p-2 rounded-lg group-hover:bg-[#771144] group-hover:text-white transition-colors duration-300 shrink-0">
                    <Eye className="w-4 h-4 text-[#771144] group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-semibold text-sm text-foreground">2. Click to view</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                      Clicking the link will automatically verify your access and open the secure viewer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground text-center border border-border/50 flex flex-col items-center gap-1">
                <span className="font-medium text-foreground">Don&apos;t have a link?</span>
                <span>Contact the founder directly to request access.</span>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center pt-2">
            <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              Powered by
              <Link target="_blank" href="https://raisegate.com" className="font-bold text-[#771144] hover:underline flex items-center gap-1">
                RaiseGate
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}