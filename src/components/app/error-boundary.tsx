import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
  /** When this value changes the boundary clears its error (e.g. after new data arrives). */
  resetKey?: unknown
}

interface ErrorBoundaryState {
  error: Error | null
  resetKey: unknown
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI render error", error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Alert variant="destructive">
        <AlertTriangleIcon />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          <p>{error.message || "An unexpected error occurred while rendering."}</p>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reload page
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }
}
