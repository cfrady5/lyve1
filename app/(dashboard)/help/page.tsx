import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const helpSections = [
  {
    title: "Getting Started",
    articles: [
      { title: "How to create your first session", href: "#create-session" },
      { title: "Adding items to your inventory", href: "#add-items" },
      { title: "Importing sales reports", href: "#import-sales" },
      { title: "Understanding profit calculations", href: "#profit-calc" },
    ],
  },
  {
    title: "Features",
    articles: [
      { title: "Using batch add for quick setup", href: "#batch-add" },
      { title: "Organizing your lyvefolio", href: "#lyvefolio" },
      { title: "Reading your insights dashboard", href: "#insights" },
      { title: "Managing multiple sessions", href: "#sessions" },
    ],
  },
  {
    title: "Billing & Plans",
    articles: [
      { title: "Understanding pricing tiers", href: "#pricing" },
      { title: "Upgrading your plan", href: "#upgrade" },
      { title: "Managing your subscription", href: "#subscription" },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Help</h1>
        <p className="text-muted-foreground">Get answers and learn how to use lyve.</p>
      </div>

      {helpSections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {section.articles.map((article) => (
                <li key={article.href}>
                  <Link
                    href={article.href}
                    className="text-sm text-primary hover:underline"
                  >
                    {article.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {/* Support Section */}
      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
          <CardDescription>Need more help?</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Email: support@lyve.app
          </p>
          <p className="text-sm text-muted-foreground">
            We typically respond within 24 hours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
