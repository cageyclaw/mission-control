import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ViewErrorBoundaryProps {
  fallbackTitle?: string;
  fallbackMessage?: string;
  children: ReactNode;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
}

export default class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ViewErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ViewErrorBoundary] View render failed', error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: 'var(--occ-text-muted)', fontFamily: 'var(--occ-font-display)' }}>
          <h3 style={{ marginBottom: 8 }}>{this.props.fallbackTitle ?? 'View failed to load'}</h3>
          <p style={{ marginBottom: 16 }}>
            {this.props.fallbackMessage ?? 'An unexpected error occurred while loading this view.'}
          </p>
          <button type="button" onClick={this.handleRetry}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
