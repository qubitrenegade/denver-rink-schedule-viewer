import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    console.log("ErrorBoundary getDerivedStateFromError, error:", error);
    return { hasError: true, error: error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary componentDidCatch: Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', margin: '10px auto', maxWidth: '800px', color: '#FFCCCB', backgroundColor: '#3B0000', border: '1px solid red', borderRadius: '8px', fontFamily: 'monospace' }}>
          <h2 style={{ color: 'red', borderBottom: '1px solid #A40000', paddingBottom: '10px' }}>
            {this.props.fallbackMessage || 'App Error: Something went wrong.'}
          </h2>
          {this.state.error && (
            <div style={{ marginTop: '15px' }}>
              <h3 style={{ color: '#FFA0A0', marginBottom: '5px' }}>Error Message:</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#2A0000', padding: '10px', borderRadius: '4px' }}>
                {this.state.error.toString()}
              </pre>
            </div>
          )}
          {this.state.errorInfo && this.state.errorInfo.componentStack && (
            <div style={{ marginTop: '15px' }}>
              <h3 style={{ color: '#FFA0A0', marginBottom: '5px' }}>Component Stack:</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#2A0000', padding: '10px', borderRadius: '4px' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
           {this.state.error && this.state.error.stack && (
            <div style={{ marginTop: '15px' }}>
              <h3 style={{ color: '#FFA0A0', marginBottom: '5px' }}>Full Stack Trace:</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#2A0000', padding: '10px', borderRadius: '4px' }}>
                {this.state.error.stack}
              </pre>
            </div>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{ marginTop: '20px', padding: '8px 15px', backgroundColor: '#A40000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Try to recover (may not work)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
