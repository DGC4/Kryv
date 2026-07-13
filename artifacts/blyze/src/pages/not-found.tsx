import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center justify-center text-center space-y-6">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold tracking-tight">404 - Not Found</h1>
          <p className="text-muted-foreground">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link href="/">
          <Button size="lg" className="font-bold">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
