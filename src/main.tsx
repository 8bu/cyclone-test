import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { worker } from "@/mocks/browser"

async function bootstrap() {
  try {
    await worker.start({
      serviceWorker: { url: "/mockServiceWorker.js" },
      onUnhandledFrame: "bypass",
      quiet: true,
    })
  } catch (error) {
    // Render anyway: the UI shows the API error state.
    console.error("Failed to start the mock API worker", error)
  }

  // Dynamic on purpose: a static import would ship the test hook in production builds.
  if (import.meta.env.MODE === "e2e") {
    const { installE2eHook } = await import("@/mocks/e2e")
    installE2eHook(worker)
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>
  )
}

void bootstrap()
