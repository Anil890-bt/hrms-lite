import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 gap-5">
          <div className="p-4 rounded-full bg-red-50">
            <AlertTriangle className="h-9 w-9 text-red-500" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-lg font-semibold text-foreground mb-1.5">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground mb-1">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error?.message && (
              <p className="text-xs font-mono bg-muted text-muted-foreground px-3 py-2 rounded-lg mt-2 text-left break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
