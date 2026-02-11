import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorAlert({ message, onRetry }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 border border-red-200">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p className="text-xs sm:text-sm flex-1">{message}</p>
      {onRetry && (
        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={onRetry}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
