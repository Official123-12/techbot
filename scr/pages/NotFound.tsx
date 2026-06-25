import { useNavLoader } from "@/App";
import { Bot, ArrowLeft } from "lucide-react";

export function NotFound() {
  const { navigateWithLoader } = useNavLoader();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-6">
        <Bot className="w-10 h-10 text-muted-foreground" />
      </div>
      <h1 className="text-6xl font-bold text-muted-foreground mb-3">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => navigateWithLoader("/")}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}
