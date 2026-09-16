import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceProvider, useWorkspace } from "@/workspace/store";
import { AuthProvider } from "@/auth/store";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WidgetGrid } from "@/components/workspace/WidgetGrid";
import { NotesTool } from "@/components/tools/NotesTool";
import { RatesTool } from "@/components/tools/RatesTool";
import { QuoteTool } from "@/components/tools/QuoteTool";
import { useAlertNotifications } from "@/lib/use-alert-notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sleek Workspace" },
      {
        name: "description",
        content:
          "A calm digital desk for hotel reservation agents: intelligent notes, senior rate calculator and PDF quotations in one transforming workspace.",
      },
      { property: "og:title", content: "Sleek Workspace" },
      {
        property: "og:description",
        content:
          "Write, recognize, save and quote - one workspace that transforms around the reservation you are working on.",
      },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const [quotePreview, setQuotePreview] = useState(false);
  const [quoteHistory, setQuoteHistory] = useState(false);

  return (
    <AuthProvider>
      <AuthGuard>
        <WorkspaceProvider>
          <div className="flex min-h-screen w-full flex-col bg-background">
            <WorkspaceHeader
              quotePreview={quotePreview}
              onToggleQuotePreview={() => {
                setQuotePreview((v) => !v);
                setQuoteHistory(false);
              }}
              quoteHistoryOpen={quoteHistory}
              onToggleQuoteHistory={() => {
                setQuoteHistory((v) => !v);
                setQuotePreview(false);
              }}
            />
            <main className="mx-auto flex w-full max-w-[1240px] min-h-0 flex-1 flex-col px-5 pb-3 pt-0">
              <Workspace
                quotePreview={quotePreview}
                quoteHistory={quoteHistory}
                onCloseQuotePanels={() => {
                  setQuotePreview(false);
                  setQuoteHistory(false);
                }}
                onToggleQuotePreview={() => {
                  setQuotePreview((v) => !v);
                  setQuoteHistory(false);
                }}
                onShowQuotePreview={() => {
                  setQuotePreview(true);
                  setQuoteHistory(false);
                }}
              />
            </main>
          </div>
        </WorkspaceProvider>
      </AuthGuard>
    </AuthProvider>
  );
}

function Workspace({
  quotePreview,
  quoteHistory,
  onCloseQuotePanels,
  onToggleQuotePreview,
  onShowQuotePreview,
}: {
  quotePreview: boolean;
  quoteHistory: boolean;
  onCloseQuotePanels: () => void;
  onToggleQuotePreview: () => void;
  onShowQuotePreview: () => void;
}) {
  const { mode, activeTool, widgets } = useWorkspace();
  const toolMode = mode === "tool";
  useAlertNotifications(widgets);

  useEffect(() => {
    if (!(toolMode && activeTool === "quote")) onCloseQuotePanels();
  }, [toolMode, activeTool]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
      {/* Tool area — expands in tool mode, retracts fully in widget mode.
          flex-1 + min-h-0 (rather than a fixed min-h) lets this card size
          itself to exactly whatever space remains above the pill nav, so it
          shrinks smoothly on resize instead of forcing the nav off-screen. */}
      <section
        className={cn(
          "desk-panel min-w-0 overflow-hidden transition-all duration-500 ease-[var(--ease-desk)]",
          toolMode
            ? "flex min-h-0 flex-1 flex-col p-4 pb-3 opacity-100 sm:p-6 sm:pb-4"
            : "pointer-events-none max-h-0 border-0 p-0 opacity-0 shadow-none",
        )}
        aria-hidden={!toolMode}
      >
        {toolMode && (
          <div className="flex min-h-0 flex-1 flex-col">
            {activeTool === "notes" && <NotesTool />}
            {activeTool === "rates" && <RatesTool />}
            {activeTool === "quote" && (
              <QuoteTool
                showPreview={quotePreview}
                showHistory={quoteHistory}
                onClosePanels={onCloseQuotePanels}
                onShowPreview={onShowQuotePreview}
              />
            )}
          </div>
        )}
      </section>

      <WidgetGrid />
    </div>
  );
}
