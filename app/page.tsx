import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/constants/brand";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-background to-secondary/20">
      <main className="flex flex-col items-center gap-12 max-w-4xl text-center">
        {/* Hero Section */}
        <div className="space-y-6 max-w-3xl">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight lowercase">
            {BRAND.NAME}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            real accounting for livestream sellers. track inventory, streams, and profitability with data, not vibes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
            <Link href="/signup">
              <Button size="lg" className="text-base h-12 px-8 shadow-lg hover:shadow-xl transition-all">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base h-12 px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 w-full max-w-4xl">
          <FeatureCard
            title="session tracking"
            description="organize inventory by stream or collection. add items with photos and cost basis."
          />
          <FeatureCard
            title="csv import"
            description="upload sales reports and automatically match to inventory by sequence."
          />
          <FeatureCard
            title={BRAND.PORTFOLIO}
            description="see all your items at a glance. filter by held or sold with profit breakdowns."
          />
          <FeatureCard
            title="profit insights"
            description="track revenue, costs, fees, and net profit across all your sessions."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="group relative p-8 border border-border bg-card rounded-2xl hover:shadow-lg hover:border-primary/20 transition-all">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative space-y-3">
        <h3 className="font-semibold text-xl">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
