"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function Home() {
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [overlayType, setOverlayType] = useState<"logo" | "text">("logo");
  const [text, setText] = useState("Sample Text");
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [size, setSize] = useState(100);
  const [fontColor, setFontColor] = useState("white");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const videoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (video) {
      const url = URL.createObjectURL(video);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [video]);

  useEffect(() => {
    if (logo) {
      const url = URL.createObjectURL(logo);
      setLogoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logo]);

  const handleVideoLoad = () => {
    if (videoRef.current && previewContainerRef.current) {
      const actualWidth = videoRef.current.videoWidth;
      const actualHeight = videoRef.current.videoHeight;
      setVideoDimensions({ width: actualWidth, height: actualHeight });

      // Wait for layout to complete, then calculate scale
      requestAnimationFrame(() => {
        if (previewContainerRef.current) {
          const containerWidth = previewContainerRef.current.clientWidth;
          const containerHeight = previewContainerRef.current.clientHeight;
          
          // Use the smaller scale to ensure the video fits
          const scaleX = containerWidth / actualWidth;
          const scaleY = containerHeight / actualHeight;
          const newScale = Math.min(scaleX, scaleY);
          
          console.log(`Video: ${actualWidth}x${actualHeight}, Container: ${containerWidth}x${containerHeight}, Scale: ${newScale}`);
          setScale(newScale);
        }
      });
    }
  };

  const getScaledPosition = useCallback((clientX: number, clientY: number) => {
    if (!previewContainerRef.current) return { x: 0, y: 0 };
    const rect = previewContainerRef.current.getBoundingClientRect();
    const scaledX = Math.round((clientX - rect.left) / scale);
    const scaledY = Math.round((clientY - rect.top) / scale);
    return { x: scaledX, y: scaledY };
  }, [scale]);

  const handleMouseDown = (e: React.MouseEvent, type: "drag" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "drag") {
      const pos = getScaledPosition(e.clientX, e.clientY);
      setDragOffset({ x: pos.x - x, y: pos.y - y });
      setIsDragging(true);
    } else {
      setIsResizing(true);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging && !isResizing) return;

    const pos = getScaledPosition(e.clientX, e.clientY);

    if (isDragging) {
      // Clamp position to stay within video bounds
      const maxX = Math.max(0, videoDimensions.width - size);
      const maxY = Math.max(0, videoDimensions.height - size);
      const newX = Math.max(0, Math.min(maxX, pos.x - dragOffset.x));
      const newY = Math.max(0, Math.min(maxY, pos.y - dragOffset.y));
      console.log(`Drag: pos=${pos.x},${pos.y} -> new=${newX},${newY} (max=${maxX},${maxY})`);
      setX(newX);
      setY(newY);
    } else if (isResizing) {
      const newSize = Math.max(20, Math.min(500, pos.x - x));
      setSize(newSize);
    }
  }, [isDragging, isResizing, dragOffset, x, y, size, videoDimensions, getScaledPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultUrl(null);

    if (!video) {
      setError("Please select a video file");
      setLoading(false);
      return;
    }

    if (overlayType === "logo" && !logo) {
      setError("Please select a logo file");
      setLoading(false);
      return;
    }

    if (overlayType === "text" && !text.trim()) {
      setError("Please enter text");
      setLoading(false);
      return;
    }

    // Clamp coordinates to video bounds before sending
    const clampedX = Math.max(0, Math.min(x, videoDimensions.width - size));
    const clampedY = Math.max(0, Math.min(y, videoDimensions.height - size));
    const clampedSize = Math.min(size, Math.min(videoDimensions.width, videoDimensions.height));
    
    console.log(`Submitting: x=${clampedX}, y=${clampedY}, size=${clampedSize} (video: ${videoDimensions.width}x${videoDimensions.height})`);

    const formData = new FormData();
    formData.append("video", video);
    formData.append("x", clampedX.toString());
    formData.append("y", clampedY.toString());
    formData.append("size", clampedSize.toString());

    if (overlayType === "logo" && logo) {
      formData.append("logo", logo);
    } else {
      formData.append("text", text);
      formData.append("font_color", fontColor);
    }

    try {
      const response = await fetch("http://localhost:8000/overlay", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process video");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Video Logo/Text Overlay Editor
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-4">
            {/* Video Upload */}
            <div className="bg-gray-800 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2">Video File</label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => setVideo(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
              >
                {video ? video.name : "Choose Video"}
              </button>
            </div>

            {/* Overlay Type Toggle */}
            <div className="bg-gray-800 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2">Overlay Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOverlayType("logo")}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                    overlayType === "logo" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  Logo (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => setOverlayType("text")}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                    overlayType === "text" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  Text
                </button>
              </div>
            </div>

            {/* Logo Upload or Text Input */}
            <div className="bg-gray-800 rounded-lg p-4">
              {overlayType === "logo" ? (
                <>
                  <label className="block text-sm font-medium mb-2">Logo (PNG)</label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png"
                    onChange={(e) => setLogo(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                  >
                    {logo ? logo.name : "Choose Logo"}
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium mb-2">Text</label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text to overlay"
                    className="w-full py-2 px-4 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <label className="block text-sm font-medium mt-3 mb-2">Font Color</label>
                  <input
                    type="text"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    placeholder="e.g., white, yellow, #ff0000"
                    className="w-full py-2 px-4 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </>
              )}
            </div>

            {/* Position and Size */}
            <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">X</label>
                <input
                  type="number"
                  value={x}
                  onChange={(e) => setX(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Y</label>
                <input
                  type="number"
                  value={y}
                  onChange={(e) => setY(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {overlayType === "logo" ? "Width" : "Size"}
                </label>
                <input
                  type="number"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {loading ? "Processing..." : "Process Video"}
            </button>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <label className="block text-sm font-medium mb-3">
                Preview <span className="text-gray-400">(drag to position, corner to resize)</span>
              </label>
              
              <div
                ref={previewContainerRef}
                className="relative bg-black rounded-lg overflow-hidden select-none"
                style={{ 
                  aspectRatio: videoDimensions.width && videoDimensions.height 
                    ? `${videoDimensions.width}/${videoDimensions.height}` 
                    : "16/9"
                }}
              >
                {videoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      onLoadedMetadata={handleVideoLoad}
                      className="w-full h-full object-contain"
                      muted
                    />
                    
                    {/* Overlay Preview */}
                    {(overlayType === "logo" ? logoUrl : text) && (
                      <div
                        className="absolute cursor-move border-2 border-dashed border-blue-400 bg-blue-500/10"
                        style={{
                          left: x * scale,
                          top: y * scale,
                          width: overlayType === "logo" ? size * scale : "auto",
                          height: overlayType === "logo" ? "auto" : "auto",
                        }}
                        onMouseDown={(e) => handleMouseDown(e, "drag")}
                      >
                        {overlayType === "logo" && logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="w-full h-auto pointer-events-none"
                            draggable={false}
                          />
                        ) : (
                          <span
                            className="whitespace-nowrap pointer-events-none px-1"
                            style={{
                              fontSize: size * scale,
                              color: fontColor,
                              textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                            }}
                          >
                            {text}
                          </span>
                        )}
                        
                        {/* Resize handle */}
                        <div
                          className="absolute -right-2 -bottom-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize hover:bg-blue-400"
                          onMouseDown={(e) => handleMouseDown(e, "resize")}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    Upload a video to preview
                  </div>
                )}
              </div>

              {videoDimensions.width > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Video: {videoDimensions.width}×{videoDimensions.height}px
                </p>
              )}
            </div>

            {/* Result Video */}
            {resultUrl && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-3">Result</h2>
                <video src={resultUrl} controls className="w-full rounded-lg" />
                <a
                  href={resultUrl}
                  download="processed_video.mp4"
                  className="mt-3 block text-center py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
                >
                  Download Video
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
