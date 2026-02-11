import { Inbox } from "lucide-react";

export default function EmptyState({ icon: Icon = Inbox, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="p-3.5 rounded-full bg-teal-50 mb-3">
        <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-teal-300" />
      </div>
      <h3 className="text-sm sm:text-base font-medium mb-1 text-foreground">{title}</h3>
      <p className="text-sm text-center max-w-xs">{description}</p>
    </div>
  );
}
