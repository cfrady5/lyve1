import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  retry
}: ErrorStateProps) {
  return (
    <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-destructive/10">
          <AlertCircle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground mb-3">{message}</p>
          {retry && (
            <Button size="sm" variant="outline" onClick={retry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
