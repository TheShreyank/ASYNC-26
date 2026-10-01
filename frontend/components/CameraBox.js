'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Image as ImageIcon, Grid, RefreshCcw, Check, CameraIcon } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CameraBox() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const shutterRef = useRef(null);
  const streamRef = useRef(null);
  
  const [photos, setPhotos] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [error, setError] = useState('');
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const hasAttemptedAutoStart = useRef(false);

  // Load photos from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('casualhealth_instants');
    if (saved) {
      try {
        setPhotos(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved photos');
      }
    }
  }, []);

  // Save to local storage whenever photos change
  useEffect(() => {
    localStorage.setItem('casualhealth_instants', JSON.stringify(photos));
  }, [photos]);

  // Slideshow timer — 15 seconds per photo
  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setSlideshowIndex((prev) => (prev + 1) % photos.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [photos.length]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async (mode = facingMode) => {
    setError('');
    stopCamera(); 
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Make sure you are using HTTPS or localhost.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 720 }, height: { ideal: 720 } },
      });
      
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setFacingMode(mode);
      setIsCameraActive(true);
    } catch (err) {
      setError(err.message || 'Could not access camera. Please allow permissions.');
      console.error('Camera error:', err);
      setIsCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  const toggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(nextMode);
  };

  // Auto-start camera on mount
  useEffect(() => {
    if (!hasAttemptedAutoStart.current && typeof window !== 'undefined') {
      hasAttemptedAutoStart.current = true;
      const isLaptop = window.innerWidth > window.innerHeight;
      const initialMode = isLaptop ? 'user' : 'environment';
      setFacingMode(initialMode);
      startCamera(initialMode);
    }
    
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Mini confetti burst around the shutter button
  const fireShutterConfetti = () => {
    if (!shutterRef.current) return;
    const rect = shutterRef.current.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 30,
      spread: 55,
      startVelocity: 18,
      origin: { x, y },
      colors: ['#4caf50', '#81c784', '#aed581', '#ffffff', '#66bb6a'],
      scalar: 0.7,
      ticks: 80,
      gravity: 1.2,
      drift: 0,
      disableForReducedMotion: true,
    });
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhotos((prev) => [{ id: Date.now(), url: dataUrl, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }, ...prev]);
    setSlideshowIndex(0);

    // Fire mini confetti
    fireShutterConfetti();
  };

  const clearPhotos = () => {
    if (confirm('Are you sure you want to delete all photos from today?')) {
      setPhotos([]);
      setSlideshowIndex(0);
    }
  };

  const copyCollageToClipboard = async () => {
    if (photos.length === 0 || !canvasRef.current) return;
    
    try {
      const count = photos.length;
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const thumbSize = 400;
      const padding = 20;
      const headerHeight = 80;
      
      const canvas = canvasRef.current;
      canvas.width = (cols * thumbSize) + (padding * (cols + 1));
      canvas.height = headerHeight + (rows * thumbSize) + (padding * (rows + 1));
      
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      const dateStr = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      ctx.fillText(`My CasualHealth Instants - ${dateStr}`, canvas.width / 2, 50);
      
      const loadImg = (src) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
      
      for (let i = 0; i < count; i++) {
        const img = await loadImg(photos[i].url);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (thumbSize + padding);
        const y = headerHeight + padding + row * (thumbSize + padding);
        
        ctx.drawImage(img, x, y, thumbSize, thumbSize);
        
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y + thumbSize - 40, thumbSize, 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(photos[i].time, x + thumbSize / 2, y + thumbSize - 12);
      }
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 3000);
        } catch (err) {
          console.error('Clipboard copy failed:', err);
          alert('Could not copy to clipboard automatically. Your browser might require you to grant permissions.');
        }
      }, 'image/png');
      
    } catch (err) {
      console.error('Error generating collage:', err);
    }
  };

  return (
    <section id="instants" className="card dash-section" style={{ scrollMarginTop: '90px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <h2 id="instants-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={20} /> Instants
        </h2>
        {photos.length > 0 && (
          <button onClick={clearPhotos} style={{ fontSize: '12px', color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Clear Album
          </button>
        )}
      </div>
      <p className="sub" style={{ marginBottom: '20px' }}>Capture 1:1 moments throughout your day. Review your album tonight.</p>
      
      {error && <p role="alert" className="err-text" style={{ fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
      
      {/* Side-by-side layout */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '40px', 
        alignItems: 'flex-start',
        margin: '0 auto'
      }}>
        
        {/* Left: Camera Viewport */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '320px' }}>
          {/* We add a spacer to match the right column's header height so they align perfectly */}
          <div style={{ height: '23px', marginBottom: '10px' }}></div>
          
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            aspectRatio: '1/1', 
            background: 'var(--surface-2)', 
            borderRadius: '16px', 
            overflow: 'hidden', 
            border: '1px solid var(--line)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
          }}>
          
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover', 
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              display: isCameraActive ? 'block' : 'none'
            }} 
          />

          {isCameraActive ? (
            <>
              {/* Shutter Button */}
              <button 
                ref={shutterRef}
                onClick={capturePhoto}
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.25)',
                  border: '3px solid white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'transform 0.1s ease'
                }}
                aria-label="Take photo"
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'white' }} />
              </button>
              
              {/* Switch Camera Button */}
              <button
                onClick={toggleCamera}
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(4px)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                aria-label="Switch camera"
                title="Switch camera"
              >
                <RefreshCcw size={14} />
              </button>

              {/* Close Camera Button */}
              <button
                onClick={stopCamera}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(4px)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                aria-label="Close camera"
                title="Close camera"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
              <Camera size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <button className="btn btn-hero" onClick={() => startCamera()} style={{ padding: '8px 16px', fontSize: '13px' }}>
                Open Camera
              </button>
            </div>
          )}
        </div>
        </div>

        {/* Right: Album Slideshow */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '320px' }}>
          <div style={{ 
            fontSize: '13px', 
            marginBottom: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            color: 'var(--ink-2)' 
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ImageIcon size={14} /> Today&apos;s Album
            </span>
            {photos.length > 0 && (
              <span style={{ 
                fontSize: '11px', 
                background: 'var(--leaf)', 
                color: '#fff', 
                borderRadius: '10px', 
                padding: '2px 8px', 
                fontWeight: '600' 
              }}>
                {photos.length}
              </span>
            )}
          </div>
          
          {photos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {/* Slideshow */}
              <div style={{ 
                width: '100%', 
                aspectRatio: '1/1', 
                borderRadius: '12px', 
                overflow: 'hidden', 
                position: 'relative', 
                border: '1px solid var(--line)', 
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  width: '100%', 
                  height: '100%', 
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: `translateX(-${slideshowIndex * 100}%)`
                }}>
                  {photos.map((photo) => (
                    <div key={photo.id} style={{ flexShrink: 0, width: '100%', height: '100%', position: 'relative' }}>
                      <img 
                        src={photo.url} 
                        alt={`Captured at ${photo.time}`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <div style={{ 
                        position: 'absolute', bottom: 0, left: 0, right: 0, 
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', 
                        color: 'white', fontSize: '13px', 
                        padding: '20px 8px 6px', textAlign: 'center', fontWeight: '500' 
                      }}>
                        {photo.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Slideshow dots */}
              {photos.length > 1 && (
                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSlideshowIndex(idx)}
                      style={{
                        width: '7px', height: '7px', borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                        background: slideshowIndex === idx ? 'var(--leaf)' : 'var(--line)',
                        transition: 'background 0.2s ease, transform 0.2s ease',
                        transform: slideshowIndex === idx ? 'scale(1.3)' : 'scale(1)'
                      }}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Collage Button */}
              <button 
                onClick={copyCollageToClipboard} 
                className="btn btn-hero" 
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', padding: '9px 14px', fontSize: '13px', width: '100%' 
                }}
              >
                {isCopied ? <Check size={14} /> : <Grid size={14} />}
                {isCopied ? 'Copied to Clipboard!' : 'Copy Daily Collage'}
              </button>
            </div>
          ) : (
            <div style={{ 
              flex: 1,
              aspectRatio: '1/1',
              background: 'var(--surface-2)', 
              borderRadius: '12px', 
              border: '1px dashed var(--line)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'var(--ink-2)' 
            }}>
              <CameraIcon size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>Take a Pic!</p>
              <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px', textAlign: 'center', padding: '0 12px' }}>
                Your moments will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </section>
  );
}
