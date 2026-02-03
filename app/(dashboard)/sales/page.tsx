import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportCSVButton } from "@/components/sales/ImportCSVButton";

export default async function SalesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from('sales_reports')
    .select('*, sessions(name), sale_items(count)')
    .eq('user_id', user?.id)
    .order('uploaded_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales</h1>
          <p className="text-muted-foreground">Import and view your sales data</p>
        </div>
        <ImportCSVButton />
      </div>

      {reports && reports.length > 0 ? (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {report.file_name}
                    </CardTitle>
                    <CardDescription>
                      Uploaded {new Date(report.uploaded_at).toLocaleDateString()} • {report.sessions?.name}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {report.sale_items?.[0]?.count || 0} items
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Sales Reports</CardTitle>
            <CardDescription>Import your first CSV to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-4">
              <p>Upload a CSV file to import your sales data</p>
              <ImportCSVButton />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How to Import Sales</CardTitle>
          <CardDescription>Follow these steps to import your Whatnot sales data</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Download your sales CSV from Whatnot</li>
            <li>Click the &quot;Import CSV&quot; button above</li>
            <li>Select the session this report belongs to</li>
            <li>Upload your CSV file</li>
            <li>Items will be automatically matched by sequence</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
