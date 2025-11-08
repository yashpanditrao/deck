"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import { useResizeObserver } from "@wojtekmaj/react-hooks";
import { pdfjs, Document, Page } from "react-pdf";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

// Configure PDF.js worker - use local file
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PDFViewerProps {
  pdfLink: string;
  isDownloadable: boolean;
}

interface ViewerState {
  numPages: number;
  pageNumber: number;
  scale: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE_MOBILE = 2.5;
const MAX_SCALE_DESKTOP = 3;
const SCALE_STEP = 0.2;
const MOBILE_BREAKPOINT = 768;

const PDFViewer = React.memo<PDFViewerProps>(({ pdfLink, isDownloadable }) => {
  console.log('PdfViewer - isDownloadable:', isDownloadable);
  const [viewerState, setViewerState] = useState<ViewerState>({
    numPages: 0,
    pageNumber: 1,
    scale: 1,
  });
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [containerHeight, setContainerHeight] = useState<number>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Memoize the maximum scale based on device type
  const maxScale = useMemo(
    () => (isMobile ? MAX_SCALE_MOBILE : MAX_SCALE_DESKTOP),
    [isMobile]
  );

  // Anti-download and security measures
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable dangerous shortcuts
      if (
        e.key === 'F12' ||
        (e.ctrlKey && ['s', 'p', 'u', 'a'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        toast.error("This action is not allowed for security reasons");
        return false;
      }

      // Navigation keys
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        previousPage();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextPage();
      }
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);

    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, []);

  // Handle device type detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(isMobileDevice);
      setViewerState((prev) => ({ ...prev, scale: 1 }));
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle container resizing
  const onResize = useCallback((entries: ResizeObserverEntry[]) => {
    const [entry] = entries;
    if (entry) {
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height);
    }
  }, []);

  useResizeObserver(containerRef, {}, onResize);

  // PDF loading handlers
  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setViewerState((prev) => ({ ...prev, numPages, pageNumber: 1 }));
      setIsLoading(false);
      setError(null);
      toast.success(`Document loaded - ${numPages} pages`);
    },
    []
  );

  const onDocumentLoadError = useCallback(
    (error: Error) => {
      console.error("PDF load error:", error);
      setIsLoading(false);
      setError("Failed to load document. Please try again later.");
      toast.error("Failed to load document. Please try again later.");
    },
    []
  );

  // Navigation handlers
  const previousPage = useCallback(() => {
    setViewerState((prev) => ({
      ...prev,
      pageNumber: Math.max(1, prev.pageNumber - 1),
    }));
  }, []);

  const nextPage = useCallback(() => {
    setViewerState((prev) => ({
      ...prev,
      pageNumber: Math.min(prev.numPages, prev.pageNumber + 1),
    }));
  }, []);

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setViewerState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + SCALE_STEP, maxScale),
    }));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setViewerState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - SCALE_STEP, MIN_SCALE),
    }));
  }, []);

  const resetZoom = useCallback(() => {
    setViewerState((prev) => ({
      ...prev,
      scale: 1,
    }));
  }, []);

  if (!pdfLink) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 mx-auto mb-4 opacity-50">📄</div>
          <p className="text-xl">No document available</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Unable to Load Document</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white select-none overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="font-semibold text-lg">Shared Pitch Deck</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isDownloadable && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = pdfLink;
                  link.download = `deck-${new Date().toISOString().split('T')[0]}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md flex items-center space-x-2 shadow-lg transition-colors duration-200"
                title="Download PDF"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </Button>
            )}
            <span className="text-sm text-gray-400">
              Page {viewerState.pageNumber} of {viewerState.numPages}
            </span>
          </div>
        </div>
      </div>

      {/* Main PDF Container */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        ref={setContainerRef}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {isLoading && (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            <p className="text-gray-300">Loading your document...</p>
          </div>
        )}
        
        <Document
          file={pdfLink}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          error={null}
          className="flex items-center justify-center"
        >
          <div className="shadow-2xl">
            <Page
              pageNumber={viewerState.pageNumber}
              scale={viewerState.scale}
              width={containerWidth ? Math.min(containerWidth * 0.9, 1200) : undefined}
              height={containerHeight ? containerHeight * 0.85 : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="bg-white"
            />
          </div>
        </Document>
      </div>

      {/* Side Navigation - Left */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={previousPage}
          disabled={viewerState.pageNumber <= 1 || isLoading}
          className="text-white hover:bg-white/20 disabled:opacity-30 bg-black/50 backdrop-blur-sm h-12 w-12 rounded-full shadow-lg"
          title="Previous page"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* Side Navigation - Right */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={nextPage}
          disabled={viewerState.pageNumber >= viewerState.numPages || isLoading}
          className="text-white hover:bg-white/20 disabled:opacity-30 bg-black/50 backdrop-blur-sm h-12 w-12 rounded-full shadow-lg"
          title="Next page"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Bottom Controls - Only Zoom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center justify-center">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={isLoading || viewerState.scale <= MIN_SCALE}
              className="text-white hover:bg-white/10 disabled:opacity-30 p-2"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              className="text-white hover:bg-white/10 px-4 py-2 text-sm font-medium"
              title="Reset zoom"
            >
              {Math.round(viewerState.scale * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={isLoading || viewerState.scale >= maxScale}
              className="text-white hover:bg-white/10 disabled:opacity-30 p-2"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Security Watermark */}
      {!isDownloadable && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 opacity-50 pointer-events-none select-none">
          🔒 Protected Document - Download Disabled
        </div>
      )}
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;