import React, { useState, useRef, useEffect } from 'react';

const MobileCameraTest = () => {
  const [status, setStatus] = useState('Ready to test camera on Chrome iOS');
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState({});
  const videoRef = useRef(null);

  // Detect device and browser info
  useEffect(() => {
    const userAgent = navigator.userAgent;
    
    // Better iOS Chrome detection
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isChromeUA = userAgent.includes('Chrome');
    const isSafariUA = userAgent.includes('Safari');
    
    // iOS Chrome detection is tricky - Chrome on iOS uses Safari's engine
    const isIOSChrome = isIOS && isChromeUA && isSafariUA;
    const isIOSSafari = isIOS && isSafariUA && !isChromeUA;
    
    // Check for media APIs with iOS-specific fallbacks
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasModernGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasLegacyGetUserMedia = !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
    const hasAnyGetUserMedia = hasModernGetUserMedia || hasLegacyGetUserMedia;
    
    console.log('User Agent:', userAgent);
    console.log('iOS Chrome Detection:', {
      isIOS,
      isChromeUA,
      isSafariUA,
      isIOSChrome,
      isIOSSafari
    });
    
    const info = {
      isIOS,
      isChrome: isIOSChrome,
      isSafari: isIOSSafari,
      isIOSChrome,
      isIOSSafari,
      protocol: location.protocol,
      hostname: location.hostname,
      isLocalNetwork: location.hostname.match(/^192\.168\./) ? true : false,
      hasMediaDevices,
      hasModernGetUserMedia,
      hasLegacyGetUserMedia,
      hasGetUserMedia: hasAnyGetUserMedia,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      userAgent: userAgent
    };
    setDeviceInfo(info);
  }, []);

  // Cross-browser getUserMedia function for iOS compatibility
  const getCompatibleUserMedia = (constraints) => {
    return new Promise((resolve, reject) => {
      // Try modern API first
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      // Fallback to legacy APIs (iOS Safari/Chrome may need this)
      const getUserMedia = navigator.getUserMedia || 
                          navigator.webkitGetUserMedia || 
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia;
      
      if (getUserMedia) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      } else {
        reject(new Error('getUserMedia is not supported in this browser'));
      }
    });
  };

  const testChromeIOSCamera = async () => {
    setStatus('Testing Chrome iOS optimized camera access...');
    setError(null);
    
    try {
      console.log('Starting Chrome iOS camera test');
      console.log('Device info:', deviceInfo);
      
      // Check HTTPS requirement - Required for camera access on all mobile devices
      if (location.protocol !== 'https:' && !location.hostname.includes('localhost')) {
        const warning = '⚠️ HTTPS required for camera access on mobile devices!';
        console.error(warning);
        throw new Error('Camera access requires HTTPS. Please use https://your-domain or https://your-ip-address');
      }
      
      if (deviceInfo.isIOS && location.protocol !== 'https:') {
        const warning = '⚠️ iOS requires HTTPS for camera access in production.';
        console.warn(warning);
        setStatus(warning + ' Development mode detected...');
      }

      // Chrome iOS specific constraints
      const constraints = {
        video: {
          facingMode: { exact: 'environment' }, // Force back camera
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        }
      };

      console.log('Using constraints:', constraints);
      console.log('Available getUserMedia methods:', {
        modern: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        legacy: !!(navigator.getUserMedia || navigator.webkitGetUserMedia)
      });
      
      const testStream = await getCompatibleUserMedia(constraints);
      
      setStatus('✅ Camera access successful!');
      
      // Set up video preview
      if (videoRef.current) {
        videoRef.current.srcObject = testStream;
        
        // iOS requires user interaction for video play
        try {
          await videoRef.current.play();
          setStatus('✅ Video preview working!');
        } catch (playErr) {
          console.warn('Video autoplay failed (normal on iOS):', playErr);
          setStatus('✅ Camera ready - tap video to start preview');
        }
      }
      
      setStream(testStream);
      
      // Log camera capabilities
      const track = testStream.getVideoTracks()[0];
      const settings = track.getSettings();
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      
      console.log('Camera track info:', {
        label: track.label,
        settings: settings,
        capabilities: capabilities
      });
      
      setStatus(`✅ SUCCESS! Camera: ${track.label || 'Unknown'}, Facing: ${settings.facingMode || 'unknown'}`);
      
    } catch (err) {
      console.error('Chrome iOS camera test failed:', err);
      
      let errorMessage = `❌ ${err.name}: ${err.message}`;
      
      // iOS Chrome specific error handling
      if (err.name === 'NotAllowedError') {
        errorMessage += '\n\n🔧 Try: Refresh page and allow camera access when prompted';
      } else if (err.name === 'NotFoundError') {
        errorMessage += '\n\n🔧 No camera found - check if camera is working in other apps';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += '\n\n🔧 Camera constraints not supported - trying fallback...';
        
        // Try simpler constraints
        try {
          const fallbackStream = await getCompatibleUserMedia({
            video: { facingMode: 'environment' }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          
          setStream(fallbackStream);
          setStatus('✅ SUCCESS with fallback constraints!');
          return;
          
        } catch (fallbackErr) {
          errorMessage += `\n\nFallback also failed: ${fallbackErr.message}`;
        }
      }
      
      setError(errorMessage);
      setStatus('❌ Camera test failed');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStatus('Camera stopped');
    }
  };

  const startVideoPreview = async () => {
    if (videoRef.current && stream) {
      try {
        await videoRef.current.play();
        setStatus('▶️ Video preview started');
      } catch (err) {
        console.warn('Video play failed:', err);
        setError(`Video preview failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-xl font-bold">📱 Chrome iOS Camera Test</h1>
          <p className="text-sm opacity-90">Optimized for mobile scanning</p>
        </div>

        {/* Device Info */}
        <div className="p-4 bg-gray-50 text-xs">
          <h3 className="font-semibold mb-2">Device Information:</h3>
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <span>iOS: {deviceInfo.isIOS ? '✅' : '❌'}</span>
              <span>Chrome: {deviceInfo.isChrome ? '✅' : '❌'}</span>
              <span>Protocol: {deviceInfo.protocol}</span>
              <span>Network: {deviceInfo.isLocalNetwork ? 'Local' : 'External'}</span>
              <span>Modern API: {deviceInfo.hasModernGetUserMedia ? '✅' : '❌'}</span>
              <span>Legacy API: {deviceInfo.hasLegacyGetUserMedia ? '✅' : '❌'}</span>
            </div>
            <div className="mt-2 pt-2 border-t">
              <p className="text-gray-600">Browser: {deviceInfo.isIOSChrome ? 'iOS Chrome' : deviceInfo.isIOSSafari ? 'iOS Safari' : 'Other'}</p>
              <p className="text-gray-600 break-all">UA: {deviceInfo.userAgent?.substring(0, 80)}...</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="p-4">
          <div className={`p-3 rounded-lg text-sm ${
            error ? 'bg-red-100 text-red-800' : 
            status.includes('✅') ? 'bg-green-100 text-green-800' : 
            'bg-blue-100 text-blue-800'
          }`}>
            <p className="whitespace-pre-line">{status}</p>
            {error && (
              <p className="mt-2 text-red-700 whitespace-pre-line font-mono text-xs">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Video Preview */}
        <div className="p-4">
          <h3 className="font-semibold mb-2">Camera Preview:</h3>
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-48 bg-black rounded-lg object-cover"
              playsInline
              muted
              onClick={startVideoPreview}
            />
            {stream && !videoRef.current?.played.length && (
              <div 
                className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg cursor-pointer"
                onClick={startVideoPreview}
              >
                <div className="text-white text-center">
                  <div className="text-3xl mb-2">▶️</div>
                  <div className="text-sm">Tap to start preview</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 space-y-3">
          <button
            onClick={testChromeIOSCamera}
            disabled={!!stream}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:bg-gray-400"
          >
            {stream ? '✅ Camera Active' : '📷 Test Chrome iOS Camera'}
          </button>
          
          {stream && (
            <button
              onClick={stopCamera}
              className="w-full py-2 bg-red-600 text-white rounded-lg font-semibold"
            >
              🛑 Stop Camera
            </button>
          )}
        </div>

        {/* Tips for iOS Chrome */}
        <div className="p-4 bg-yellow-50 border-t">
          <h3 className="font-semibold text-yellow-800 mb-2">💡 Chrome iOS Tips:</h3>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• Allow camera permission when prompted</li>
            <li>• Hold phone in portrait mode</li>
            <li>• Ensure good lighting</li>
            <li>• Back camera works best for scanning</li>
            <li>• HTTPS required for mobile camera access</li>
            <li>• Use https://your-ip-address:5173 for mobile testing</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MobileCameraTest;