"use client";

import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
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
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Memoize the maximum scale based on device type
  const maxScale = useMemo(
    () => (isMobile ? MAX_SCALE_MOBILE : MAX_SCALE_DESKTOP),
    [isMobile]
  );

  // Navigation handlers
  const previousPage = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      pageNumber: Math.max(1, prev.pageNumber - 1),
    }));
  }, []);

  const nextPage = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      pageNumber: Math.min(prev.numPages, prev.pageNumber + 1),
    }));
  }, []);

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      scale: Math.min(prev.scale + SCALE_STEP, maxScale),
    }));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      scale: Math.max(prev.scale - SCALE_STEP, MIN_SCALE),
    }));
  }, []);

  const resetZoom = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      scale: 1,
    }));
  }, []);

  // Handle device type detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(isMobileDevice);
      setViewerState(prev => ({ ...prev, scale: 1 }));
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
      setViewerState(prev => ({ ...prev, numPages, pageNumber: 1 }));
      setIsLoading(false);
      setError(null);
    },
    []
  );

  const onDocumentLoadError = useCallback(
    (error: Error) => {
      console.error("PDF load error:", error);
      setIsLoading(false);
      setError("Failed to load document. Please try again later.");
    },
    []
  );

  // Touch event handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 50) {
      // Swipe left - next page
      nextPage();
    }

    if (touchStart - touchEnd < -50) {
      // Swipe right - previous page
      previousPage();
    }
  };

  // Security measures
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && ['s', 'p', 'u', 'a'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        return false;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        previousPage();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextPage();
      }
    };
    const handleSelectStart = (e: Event) => e.preventDefault();
    const handleDragStart = (e: DragEvent) => e.preventDefault();

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [previousPage, nextPage]);

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
      {/* Header - Title and Download Button */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <h1 className="font-semibold text-lg">Shared Pitch Deck</h1>
          </div>
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
              {!isMobile && <span>Download PDF</span>}
            </Button>
          )}
        </div>
      </div>

      {/* Main PDF Container */}
      <div 
        className={`absolute inset-0 ${isMobile ? 'top-16' : 'top-0'} flex items-center justify-center`}
        ref={setContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Document
          file={pdfLink}
          loading={
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
              <span className="text-white">Loading document...</span>
            </div>
          }
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          className="relative"
        >
          <div className="shadow-2xl">
            <Page
              pageNumber={viewerState.pageNumber}
              scale={viewerState.scale}
              width={containerWidth ? Math.min(containerWidth * 0.9, 1200) : undefined}
              height={containerHeight ? containerHeight * 0.8 : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="bg-white"
            />
          </div>
        </Document>
      </div>

      {/* Navigation Buttons */}
      <div className={`absolute ${isMobile ? 'left-4 right-4 bottom-24' : 'left-4 right-4 top-1/2 -translate-y-1/2'} flex items-center justify-between z-20`}>
        <Button
          variant="ghost"
          size={isMobile ? "icon" : "default"}
          onClick={previousPage}
          disabled={viewerState.pageNumber <= 1 || isLoading}
          className="text-white hover:bg-white/20 disabled:opacity-30 bg-black/50 backdrop-blur-sm rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          style={isMobile ? { width: '3.5rem', height: '3.5rem' } : { padding: '0.5rem 1rem' }}
          title="Previous page"
        >
          {isMobile ? (
            <ChevronLeft className="w-7 h-7" />
          ) : (
            <div className="flex items-center">
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span>Previous</span>
            </div>
          )}
        </Button>
        
        <Button
          variant="ghost"
          size={isMobile ? "icon" : "default"}
          onClick={nextPage}
          disabled={viewerState.pageNumber >= viewerState.numPages || isLoading}
          className="text-white hover:bg-white/20 disabled:opacity-30 bg-black/50 backdrop-blur-sm rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          style={isMobile ? { width: '3.5rem', height: '3.5rem' } : { padding: '0.5rem 1rem' }}
          title="Next page"
        >
          {isMobile ? (
            <ChevronRight className="w-7 h-7" />
          ) : (
            <div className="flex items-center">
              <span>Next</span>
              <ChevronRight className="w-5 h-5 ml-1" />
            </div>
          )}
        </Button>
      </div>

      {/* Bottom Controls - Zoom and Page Count */}
      <div className={`absolute ${isMobile ? 'bottom-4' : 'bottom-0'} left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4`}>
        <div className="flex items-center justify-center gap-4">
          {/* Page Info */}
          <div className="text-sm text-white/90 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
            Page {viewerState.pageNumber} of {viewerState.numPages}
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center bg-black/50 backdrop-blur-sm rounded-lg shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={isLoading || viewerState.scale <= MIN_SCALE}
              className="text-white hover:bg-white/20 disabled:opacity-30 p-2"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <div className="text-sm text-white/90 px-3 py-2 w-16 text-center">
              {Math.round(viewerState.scale * 100)}%
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={isLoading || viewerState.scale >= maxScale}
              className="text-white hover:bg-white/20 disabled:opacity-30 p-2"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Security Watermark */}
      {!isDownloadable && (
        <div className={`absolute ${isMobile ? 'bottom-24' : 'bottom-4'} left-4 text-xs text-gray-500 opacity-50 pointer-events-none select-none`}>
          🔒 Protected Document - Download Disabled
        </div>
      )}
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;