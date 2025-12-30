import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

/**
 * CameraScanner component for scanning barcodes and QR codes using device camera
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the scanner is active/visible
 * @param {function} props.onScan - Callback function called when a code is scanned successfully
 * @param {function} props.onClose - Callback function to close the scanner
 * @param {string} props.title - Title to display in the scanner modal
 * @param {string} props.description - Description text to show below title
 * @param {Array<string>} props.formats - Array of barcode formats to scan (optional)
 * @param {boolean} props.continuous - Whether to continue scanning after first successful scan
 */
const CameraScanner = ({
  isOpen = false,
  onScan,
  onClose,
  title = "Scan Barcode",
  description = "Point your camera at a barcode or QR code to scan it.",
  formats = [], // Empty array means all formats
  continuous = false
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize the barcode reader
  useEffect(() => {
    if (isOpen) {
      readerRef.current = new BrowserMultiFormatReader();
      
      // Set specific formats if provided
      if (formats.length > 0) {
        // Note: ZXing library format configuration would go here if needed
        // For now, we'll use the default multi-format reader
      }
      
      initializeCamera();
    }
    
    return () => {
      cleanup();
    };
  }, [isOpen]);

  // Cleanup function
  const cleanup = () => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setError(null);
    setTorchOn(false);
  };

  // Initialize camera and get available devices
  const initializeCamera = async () => {
    try {
      setError(null);
      
      // Check if we're on HTTPS (required for camera access)
      // Chrome on iOS is more lenient with localhost camera access
      const isLocalhost = location.hostname === 'localhost' || 
                         location.hostname === '127.0.0.1' || 
                         location.hostname.endsWith('.localhost') ||
                         location.hostname.match(/^192\.168\./); // Local network IPs
      
      const isChrome = navigator.userAgent.includes('Chrome');
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (location.protocol !== 'https:' && !isLocalhost) {
        setError('Camera access requires HTTPS connection. For local development on Chrome/iOS, camera access may still work.');
        // Don't return - let Chrome try anyway
        console.warn('Camera access on HTTP - Chrome on iOS may still allow this for local development');
      }
      
      // Log browser info for debugging
      console.log('Browser detection:', {
        isChrome,
        isIOS,
        isLocalhost,
        protocol: location.protocol,
        hostname: location.hostname,
        userAgent: navigator.userAgent.substring(0, 100) + '...'
      });
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser.');
        return;
      }
      
      // Safari-specific: Skip permission query as it's not reliable in Safari
      // Instead, try to access camera directly and handle errors
      let permission = null;
      try {
        if (navigator.permissions && navigator.permissions.query) {
          permission = await navigator.permissions.query({ name: 'camera' });
          setHasPermission(permission.state === 'granted');
          
          if (permission.state === 'denied') {
            setError('Camera permission denied. Please check browser settings and allow camera access.');
            return;
          }
        }
      } catch (permErr) {
        // Safari often fails on permissions.query, so we'll continue without it
        console.warn('Permission query failed (this is normal in Safari):', permErr);
      }

      // Cross-browser getUserMedia function
      const getCompatibleUserMedia = (constraints) => {
        return new Promise((resolve, reject) => {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then(resolve).catch(reject);
          } else {
            const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (getUserMedia) {
              getUserMedia.call(navigator, constraints, resolve, reject);
            } else {
              reject(new Error('getUserMedia not supported'));
            }
          }
        });
      };
      
      // Try to get video devices first with a simple getUserMedia call
      // This helps establish permission in Safari/iOS Chrome
      let testStream = null;
      try {
        testStream = await getCompatibleUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        // Immediately stop the test stream
        testStream.getTracks().forEach(track => track.stop());
      } catch (testErr) {
        console.log('Test stream failed, trying fallback:', testErr);
        try {
          testStream = await getCompatibleUserMedia({ video: true });
          testStream.getTracks().forEach(track => track.stop());
        } catch (fallbackErr) {
          console.error('Camera access failed:', fallbackErr);
          let errorMessage = 'Failed to access camera. ';
          
          if (fallbackErr.name === 'NotAllowedError') {
            errorMessage += 'Please allow camera access in your browser settings.';
          } else if (fallbackErr.name === 'NotFoundError') {
            errorMessage += 'No camera devices found.';
          } else if (fallbackErr.name === 'NotReadableError') {
            errorMessage += 'Camera is in use by another application.';
          } else if (fallbackErr.name === 'OverconstrainedError') {
            errorMessage += 'Camera constraints could not be satisfied.';
          } else {
            errorMessage += `Error: ${fallbackErr.message}`;
          }
          
          setError(errorMessage);
          return;
        }
      }

      // Get available video devices
      let videoDevices = [];
      try {
        videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      } catch (deviceErr) {
        // Fallback for browsers that don't support enumerateDevices properly
        console.warn('Device enumeration failed, using default device:', deviceErr);
        videoDevices = [{ deviceId: 'default', label: 'Default Camera' }];
      }
      
      setDevices(videoDevices);
      
      if (videoDevices.length === 0) {
        setError('No camera devices found.');
        return;
      }

      // Select the back camera if available (usually better for barcode scanning)
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      const deviceToUse = backCamera || videoDevices[0];
      setSelectedDevice(deviceToUse);
      
      startScanning(deviceToUse.deviceId);
      
    } catch (err) {
      console.error('Failed to initialize camera:', err);
      let errorMessage = 'Failed to access camera. ';
      
      // Provide more specific error messages
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Camera access denied. Please check your browser settings and allow camera access for this site.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please ensure your device has a camera.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera is busy or in use by another application.';
      } else if (err.name === 'SecurityError') {
        errorMessage += 'Camera access blocked due to security restrictions. Please use HTTPS.';
      } else {
        errorMessage += 'Please ensure you have granted camera permissions and try again.';
      }
      
      setError(errorMessage);
    }
  };

  // Start scanning with selected device
  const startScanning = async (deviceId) => {
    try {
      setError(null);
      setIsScanning(true);

      // Prepare constraints optimized for iOS Chrome
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = navigator.userAgent.includes('Chrome');
      
      let constraints = {
        video: {
          // iOS Chrome works best with these constraints
          width: isIOS ? { ideal: 1280, max: 1920 } : { ideal: 1280, max: 1920 },
          height: isIOS ? { ideal: 720, max: 1080 } : { ideal: 720, max: 1080 },
          // iOS Chrome prefers frameRate specification
          frameRate: isIOS ? { ideal: 30, max: 30 } : { ideal: 30 }
        }
      };

      // Handle device selection with iOS Chrome optimizations
      if (deviceId && deviceId !== 'default') {
        if (isIOS && isChrome) {
          // iOS Chrome handles facingMode better than deviceId
          constraints.video.facingMode = { exact: 'environment' };
        } else {
          try {
            constraints.video.deviceId = { exact: deviceId };
          } catch {
            constraints.video.facingMode = { ideal: 'environment' };
          }
        }
      } else {
        // Use facingMode for better iOS Chrome compatibility
        constraints.video.facingMode = isIOS ? { exact: 'environment' } : { ideal: 'environment' };
      }
      
      console.log('Camera constraints for iOS Chrome:', constraints);

      // Redefine the helper function in this scope
      const getCompatibleUserMedia = (constraints) => {
        return new Promise((resolve, reject) => {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then(resolve).catch(reject);
          } else {
            const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (getUserMedia) {
              getUserMedia.call(navigator, constraints, resolve, reject);
            } else {
              reject(new Error('getUserMedia not supported'));
            }
          }
        });
      };
      
      let stream = null;
      try {
        stream = await getCompatibleUserMedia(constraints);
      } catch (constraintErr) {
        console.warn('Constraint failed, trying simplified constraints:', constraintErr);
        
        // Fallback to minimal constraints for Safari
        const fallbackConstraints = {
          video: {
            facingMode: { ideal: 'environment' }
          }
        };
        
        try {
          stream = await getCompatibleUserMedia(fallbackConstraints);
        } catch (fallbackErr) {
          console.warn('Fallback failed, trying basic video for iOS Chrome:', fallbackErr);
          
          // iOS Chrome specific fallback
          const iosBasicConstraints = isIOS ? {
            video: {
              facingMode: 'environment',
              width: { ideal: 640 },
              height: { ideal: 480 }
            }
          } : { video: true };
          
          stream = await getCompatibleUserMedia(iosBasicConstraints);
        }
      }
      
      if (!stream) {
        throw new Error('Unable to get camera stream');
      }
      
      streamRef.current = stream;
      
      // Check if torch is supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      setTorchSupported(!!(capabilities.torch));

      // Set video stream with Safari compatibility
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Safari requires explicit play() with user gesture handling
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play failed (normal in some browsers):', playErr);
          // Video will auto-play when ready in most cases
        }
      }

      // Wait for video to be ready before starting to decode
      const waitForVideo = () => {
        return new Promise((resolve) => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            resolve();
          } else {
            const checkReady = () => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            setTimeout(checkReady, 100);
          }
        });
      };
      
      await waitForVideo();

      // Start decoding from video stream
      try {
        readerRef.current.decodeFromVideoDevice(
          deviceId === 'default' ? undefined : deviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const scannedText = result.getText();
              console.log('Barcode scanned:', scannedText);
              
              // Call the onScan callback
              if (onScan) {
                onScan(scannedText);
              }
              
              // Close scanner if not in continuous mode
              if (!continuous) {
                handleClose();
              }
            }
            
            if (error && !(error instanceof NotFoundException)) {
              console.warn('Scanning error:', error);
            }
          }
        );
      } catch (decodeErr) {
        console.error('Decode setup failed:', decodeErr);
        setError('Failed to initialize barcode scanning. Please try again.');
        setIsScanning(false);
        return;
      }

    } catch (err) {
      console.error('Failed to start scanning:', err);
      
      let errorMessage = 'Failed to start camera scanning. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera access and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera found.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera is in use by another app.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera settings not supported.';
      } else {
        errorMessage += 'Please check camera permissions and try again.';
      }
      
      setError(errorMessage);
      setIsScanning(false);
    }
  };

  // Switch camera device
  const switchCamera = (deviceId) => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    cleanup();
    setSelectedDevice(devices.find(d => d.deviceId === deviceId));
    startScanning(deviceId);
  };

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    
    try {
      const track = streamRef.current.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }]
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  // Handle close
  const handleClose = () => {
    cleanup();
    if (onClose) {
      onClose();
    }
  };

  // Don't render anything if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camera View */}
        <div className="p-4">
          {error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="text-sm">{error}</p>
              <div className="mt-3 space-y-2">
                <button
                  onClick={initializeCamera}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 mr-2"
                >
                  Retry
                </button>
                <button
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                      stream.getTracks().forEach(track => track.stop());
                      setError(null);
                      initializeCamera();
                    } catch (err) {
                      console.error('Manual permission request failed:', err);
                      setError(`Permission request failed: ${err.message}`);
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Request Camera Permission
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <p>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Other'}</p>
                <p>iOS: {/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'Yes' : 'No'}</p>
                <p>HTTPS: {location.protocol === 'https:' ? 'Yes' : 'No'}</p>
                <p>MediaDevices: {navigator.mediaDevices ? 'Available' : 'Not Available'}</p>
                <p>Local Network: {location.hostname.match(/^192\.168\./) ? 'Yes' : 'No'}</p>
              </div>
            </div>
          ) : isScanning ? (
            <div className="relative">
              {/* Video element */}
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-lg bg-black"
                playsInline
                muted
              />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-blue-500 rounded-lg w-48 h-48 relative">
                  <div className="absolute inset-0 border-2 border-blue-500 rounded-lg animate-pulse opacity-50"></div>
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                </div>
              </div>

              {/* Controls overlay */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                {/* Camera switch */}
                {devices.length > 1 && (
                  <select
                    value={selectedDevice?.deviceId || ''}
                    onChange={(e) => switchCamera(e.target.value)}
                    className="text-xs bg-black bg-opacity-50 text-white border border-gray-400 rounded px-2 py-1"
                  >
                    {devices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Torch toggle */}
                {torchSupported && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-full ${torchOn ? 'bg-yellow-500' : 'bg-black bg-opacity-50'} text-white`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 dark:bg-gray-700 h-64 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Initializing camera...</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="px-4 pb-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Position the barcode or QR code within the scanning area. The code will be detected automatically.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraScanner;