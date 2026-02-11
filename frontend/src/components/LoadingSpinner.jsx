import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mb-2.5 text-teal-500" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
