import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CameraScanner from './CameraScanner';

// Mock the ZXing library
jest.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    reset: jest.fn(),
    decodeFromVideoDevice: jest.fn(),
  })),
  NotFoundException: class NotFoundException extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundException';
    }
  },
}));

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: jest.fn(),
  permissions: {
    query: jest.fn(),
  },
};

Object.defineProperty(window.navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices,
});

// Mock navigator.permissions
Object.defineProperty(window.navigator, 'permissions', {
  writable: true,
  value: {
    query: jest.fn(),
  },
});

describe('CameraScanner Component', () => {
  const defaultProps = {
    isOpen: true,
    onScan: jest.fn(),
    onClose: jest.fn(),
    title: 'Test Scanner',
    description: 'Test description',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful camera permission
    navigator.permissions.query.mockResolvedValue({
      state: 'granted'
    });
    
    // Mock successful media stream
    const mockTrack = {
      stop: jest.fn(),
      getCapabilities: jest.fn().mockReturnValue({}),
      applyConstraints: jest.fn().mockResolvedValue(),
    };
    
    const mockStream = {
      getTracks: jest.fn().mockReturnValue([mockTrack]),
      getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
    };
    
    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
  });

  test('renders scanner when isOpen is true', async () => {
    render(<CameraScanner {...defaultProps} />);
    
    expect(screen.getByText('Test Scanner')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    render(<CameraScanner {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Test Scanner')).not.toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    render(<CameraScanner {...defaultProps} />);
    
    const closeButton = screen.getByRole('button', { name: /close|cancel/i });
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('shows error message when camera permission is denied', async () => {
    navigator.permissions.query.mockResolvedValue({
      state: 'denied'
    });
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/camera permission denied/i)).toBeInTheDocument();
    });
  });

  test('shows error message when no camera devices found', async () => {
    const { BrowserMultiFormatReader } = require('@zxing/library');
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([]);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/no camera devices found/i)).toBeInTheDocument();
    });
  });

  test('initializes camera with video devices', async () => {
    const mockDevices = [
      { deviceId: 'device1', label: 'Front Camera' },
      { deviceId: 'device2', label: 'Back Camera' }
    ];
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue(mockDevices);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(BrowserMultiFormatReader.listVideoInputDevices).toHaveBeenCalled();
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });
  });

  test('prefers back camera when available', async () => {
    const mockDevices = [
      { deviceId: 'front1', label: 'Front Camera' },
      { deviceId: 'back1', label: 'Back Camera' }
    ];
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue(mockDevices);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            deviceId: { exact: 'back1' }
          })
        })
      );
    });
  });

  test('calls onScan callback when barcode is detected', async () => {
    const mockResult = {
      getText: jest.fn().mockReturnValue('TEST_BARCODE_123')
    };
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    const mockReader = {
      reset: jest.fn(),
      decodeFromVideoDevice: jest.fn((deviceId, video, callback) => {
        // Simulate successful scan
        setTimeout(() => callback(mockResult, null), 100);
      })
    };
    
    BrowserMultiFormatReader.mockImplementation(() => mockReader);
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera' }
    ]);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(defaultProps.onScan).toHaveBeenCalledWith('TEST_BARCODE_123');
    }, { timeout: 2000 });
  });

  test('closes scanner automatically after scan in non-continuous mode', async () => {
    const mockResult = {
      getText: jest.fn().mockReturnValue('TEST_BARCODE_123')
    };
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    const mockReader = {
      reset: jest.fn(),
      decodeFromVideoDevice: jest.fn((deviceId, video, callback) => {
        setTimeout(() => callback(mockResult, null), 100);
      })
    };
    
    BrowserMultiFormatReader.mockImplementation(() => mockReader);
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera' }
    ]);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} continuous={false} />);
    });
    
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  test('does not close scanner after scan in continuous mode', async () => {
    const mockResult = {
      getText: jest.fn().mockReturnValue('TEST_BARCODE_123')
    };
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    const mockReader = {
      reset: jest.fn(),
      decodeFromVideoDevice: jest.fn((deviceId, video, callback) => {
        setTimeout(() => callback(mockResult, null), 100);
      })
    };
    
    BrowserMultiFormatReader.mockImplementation(() => mockReader);
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera' }
    ]);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} continuous={true} />);
    });
    
    await waitFor(() => {
      expect(defaultProps.onScan).toHaveBeenCalledWith('TEST_BARCODE_123');
    }, { timeout: 2000 });
    
    // Wait a bit more to ensure onClose is not called
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  test('shows torch button when torch is supported', async () => {
    const mockTrack = {
      stop: jest.fn(),
      getCapabilities: jest.fn().mockReturnValue({ torch: true }),
      applyConstraints: jest.fn().mockResolvedValue(),
    };
    
    const mockStream = {
      getTracks: jest.fn().mockReturnValue([mockTrack]),
      getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
    };
    
    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera' }
    ]);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      // Look for the torch/flashlight button (svg icon)
      const torchButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg')
      );
      expect(torchButtons.length).toBeGreaterThan(0);
    });
  });

  test('toggles torch when torch button is clicked', async () => {
    const mockTrack = {
      stop: jest.fn(),
      getCapabilities: jest.fn().mockReturnValue({ torch: true }),
      applyConstraints: jest.fn().mockResolvedValue(),
    };
    
    const mockStream = {
      getTracks: jest.fn().mockReturnValue([mockTrack]),
      getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
    };
    
    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera' }
    ]);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(async () => {
      const torchButton = screen.getAllByRole('button').find(button => 
        button.querySelector('svg') && !button.textContent.includes('Cancel')
      );
      
      if (torchButton) {
        fireEvent.click(torchButton);
        expect(mockTrack.applyConstraints).toHaveBeenCalledWith({
          advanced: [{ torch: true }]
        });
      }
    });
  });

  test('shows camera switch dropdown when multiple cameras available', async () => {
    const mockDevices = [
      { deviceId: 'device1', label: 'Front Camera' },
      { deviceId: 'device2', label: 'Back Camera' }
    ];
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue(mockDevices);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByDisplayValue(/camera/i)).toBeInTheDocument();
    });
  });

  test('handles getUserMedia errors gracefully', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Camera access denied'));
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera' }
    ]);
    
    await act(async () => {
      render(<CameraScanner {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/failed to start camera scanning/i)).toBeInTheDocument();
    });
  });

  test('cleans up resources when component unmounts', async () => {
    const mockTrack = {
      stop: jest.fn(),
      getCapabilities: jest.fn().mockReturnValue({}),
      applyConstraints: jest.fn().mockResolvedValue(),
    };
    
    const mockStream = {
      getTracks: jest.fn().mockReturnValue([mockTrack]),
      getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
    };
    
    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
    
    const { BrowserMultiFormatReader } = require('@zxing/library');
    const mockReader = {
      reset: jest.fn(),
      decodeFromVideoDevice: jest.fn()
    };
    
    BrowserMultiFormatReader.mockImplementation(() => mockReader);
    BrowserMultiFormatReader.listVideoInputDevices = jest.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera' }
    ]);
    
    const { unmount } = render(<CameraScanner {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });
    
    unmount();
    
    expect(mockReader.reset).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});