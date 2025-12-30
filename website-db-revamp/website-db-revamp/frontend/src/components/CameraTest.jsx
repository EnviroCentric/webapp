import React, { useState, useRef } from 'react';

const CameraTest = () => {
  const [status, setStatus] = useState('Click "Test Camera" to start');
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  const testBasicCamera = async () => {
    setStatus('Testing basic camera access...');
    setError(null);
    
    try {
      console.log('Browser info:', {
        userAgent: navigator.userAgent,
        protocol: location.protocol,
        hostname: location.hostname,
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      });

      // Test 1: Basic camera access
      const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStatus('Basic camera access: ✅ SUCCESS');
      
      // Test 2: Set stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = basicStream;
        await videoRef.current.play();
        setStatus('Video display: ✅ SUCCESS');
      }
      
      setStream(basicStream);
      
      // Test 3: Get camera info
      const tracks = basicStream.getVideoTracks();
      const track = tracks[0];
      const settings = track.getSettings();
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      
      console.log('Camera info:', {
        label: track.label,
        kind: track.kind,
        settings: settings,
        capabilities: capabilities
      });
      
      setStatus(`Camera working! Device: ${track.label || 'Unknown'}`);
      
    } catch (err) {
      console.error('Camera test failed:', err);
      setError(`${err.name}: ${err.message}`);
      setStatus('❌ FAILED');
    }
  };

  const testEnvironmentCamera = async () => {
    setStatus('Testing environment (back) camera...');
    setError(null);
    
    try {
      const envStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = envStream;
        await videoRef.current.play();
      }
      
      setStream(envStream);
      
      const track = envStream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      setStatus(`Environment camera working! Facing: ${settings.facingMode || 'unknown'}`);
      
    } catch (err) {
      console.error('Environment camera test failed:', err);
      setError(`${err.name}: ${err.message}`);
      setStatus('❌ Environment camera failed');
    }
  };

  const testDeviceList = async () => {
    setStatus('Testing device enumeration...');
    setError(null);
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('Video devices:', videoDevices);
      
      if (videoDevices.length === 0) {
        setStatus('❌ No video devices found');
        return;
      }
      
      setStatus(`Found ${videoDevices.length} camera(s):`);
      videoDevices.forEach((device, index) => {
        console.log(`Camera ${index + 1}:`, {
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          groupId: device.groupId
        });
      });
      
    } catch (err) {
      console.error('Device enumeration failed:', err);
      setError(`${err.name}: ${err.message}`);
      setStatus('❌ Device enumeration failed');
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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Camera Debug Test</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Status:</h3>
        <p className={`p-3 rounded ${error ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
          {status}
        </p>
        {error && (
          <p className="mt-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            Error: {error}
          </p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Video Preview:</h3>
        <video
          ref={videoRef}
          className="w-full h-64 bg-black rounded border"
          playsInline
          muted
          style={{ objectFit: 'cover' }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button
          onClick={testBasicCamera}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Test Camera
        </button>
        <button
          onClick={testEnvironmentCamera}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          Test Back Camera
        </button>
        <button
          onClick={testDeviceList}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
        >
          List Devices
        </button>
        <button
          onClick={stopCamera}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
        >
          Stop Camera
        </button>
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p><strong>Browser:</strong> {navigator.userAgent}</p>
        <p><strong>Protocol:</strong> {location.protocol}</p>
        <p><strong>Host:</strong> {location.hostname}</p>
        <p><strong>MediaDevices:</strong> {navigator.mediaDevices ? '✅ Available' : '❌ Not Available'}</p>
        <p><strong>GetUserMedia:</strong> {navigator.mediaDevices?.getUserMedia ? '✅ Available' : '❌ Not Available'}</p>
      </div>
    </div>
  );
};

export default CameraTest;