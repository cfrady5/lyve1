'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BRAND } from '@/lib/constants/brand';
import {
  Package,
  TrendingUp,
  DollarSign,
  BarChart3,
  CheckCircle2,
  Camera,
  Calculator,
  FileText
} from 'lucide-react';

export function HomeContent() {
  return (
    <div className="container max-w-6xl mx-auto py-8 space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-8">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          turn every show into data
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
          {BRAND.NAME} helps livestream sellers track inventory, streams, and profitability with real accounting, not vibes
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/sessions">create a session</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg px-8">
            <Link href="/lyvefolio">open {BRAND.PORTFOLIO}</Link>
          </Button>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="border-t pt-16 space-y-4">
        <h2 className="text-3xl font-bold text-center">the mission</h2>
        <div className="max-w-3xl mx-auto space-y-4 text-lg text-muted-foreground">
          <p>
            {BRAND.NAME} was built for livestream sellers who want to run their business like a business.
          </p>
          <p>
            From photo upload to post-show reconciliation, {BRAND.NAME} tracks every card, every cost, every sale.
            You get real breakeven numbers, actual profit margins, and insights that show you what is working and what is not.
          </p>
          <p>
            No guesswork. No spreadsheet chaos. Just clean data and smart decisions for every show.
          </p>
        </div>
      </section>

      {/* Features Overview */}
      <section className="space-y-8 border-t pt-16">
        <h2 className="text-3xl font-bold text-center">how it works</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* lyvefolio */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">{BRAND.PORTFOLIO}</CardTitle>
              </div>
              <CardDescription>your inventory database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <Camera className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">quick add with photos</p>
                  <p className="text-sm text-muted-foreground">snap a pic, enter cost, done</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">cost basis tracking</p>
                  <p className="text-sm text-muted-foreground">know exactly what you paid</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">sold tab and history</p>
                  <p className="text-sm text-muted-foreground">see every outcome, every sale</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">comps with {BRAND.RANGE}</p>
                  <p className="text-sm text-muted-foreground">eBay integration for smart pricing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">sessions</CardTitle>
              </div>
              <CardDescription>pre-show to post-show workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">build run order</p>
                  <p className="text-sm text-muted-foreground">number cards 1 to N</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calculator className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">pre-show breakeven calculator</p>
                  <p className="text-sm text-muted-foreground">know your numbers before you go live</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">breaks support</p>
                  <p className="text-sm text-muted-foreground">PYT, PYP, random, mixer breaks</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">post-show reconcile</p>
                  <p className="text-sm text-muted-foreground">CSV import and analytics</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">sales</CardTitle>
              </div>
              <CardDescription>transaction log</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">complete audit trail</p>
                  <p className="text-sm text-muted-foreground">every sale, every fee, every profit</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">export ready</p>
                  <p className="text-sm text-muted-foreground">clean data for your accountant</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">insights</CardTitle>
              </div>
              <CardDescription>your seller profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">best price ranges</p>
                  <p className="text-sm text-muted-foreground">see where your money comes from</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">profit drivers and leaks</p>
                  <p className="text-sm text-muted-foreground">what works, what does not</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">player and sport analysis</p>
                  <p className="text-sm text-muted-foreground">when metadata is available</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-8 border-t pt-16">
        <h2 className="text-3xl font-bold text-center">three steps to better shows</h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold mx-auto">
              1
            </div>
            <h3 className="text-xl font-semibold">prep</h3>
            <p className="text-muted-foreground">
              add inventory to {BRAND.PORTFOLIO}, create a session, build your run order, see your breakeven
            </p>
          </div>

          <div className="space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold mx-auto">
              2
            </div>
            <h3 className="text-xl font-semibold">run</h3>
            <p className="text-muted-foreground">
              go live, sell your cards, stream with confidence knowing your numbers
            </p>
          </div>

          <div className="space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold mx-auto">
              3
            </div>
            <h3 className="text-xl font-semibold">reconcile and learn</h3>
            <p className="text-muted-foreground">
              import CSV results, see profit breakdown, review the {BRAND.NAME} report, get better for next show
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t pt-12 pb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-bold lowercase">{BRAND.NAME}</h2>
            <p className="text-sm text-muted-foreground">
              real accounting for livestream sellers
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/sessions" className="text-muted-foreground hover:text-foreground">
              sessions
            </Link>
            <Link href="/lyvefolio" className="text-muted-foreground hover:text-foreground">
              {BRAND.PORTFOLIO}
            </Link>
            <Link href="/sales" className="text-muted-foreground hover:text-foreground">
              sales
            </Link>
            <Link href="/insights" className="text-muted-foreground hover:text-foreground">
              insights
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
