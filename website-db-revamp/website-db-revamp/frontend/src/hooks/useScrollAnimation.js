import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for smooth scroll-based animations with performance optimizations
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Minimum scroll change to trigger update (default: 5)
 * @param {boolean} options.enabled - Whether animation is enabled (default: true)
 * @returns {Object} - Scroll position and animation utilities
 */
export const useScrollAnimation = (options = {}) => {
  const {
    threshold = 5,
    enabled = true
  } = options;

  const [scrollY, setScrollY] = useState(0);
  const animationFrameRef = useRef();
  const lastScrollY = useRef(0);
  const isScrolling = useRef(false);

  const updateScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    // Only update if scroll position changed significantly
    if (Math.abs(currentScrollY - lastScrollY.current) >= threshold) {
      lastScrollY.current = currentScrollY;
      setScrollY(currentScrollY);
    }
    
    isScrolling.current = false;
  }, [threshold]);

  const handleScroll = useCallback(() => {
    if (!enabled) return;
    
    // Cancel the previous animation frame if it exists
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (!isScrolling.current) {
      isScrolling.current = true;
      animationFrameRef.current = requestAnimationFrame(updateScroll);
    }
  }, [enabled, updateScroll]);

  useEffect(() => {
    if (!enabled) return;

    // Use passive event listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Set initial scroll position
    setScrollY(window.scrollY);
    lastScrollY.current = window.scrollY;

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, handleScroll]);

  return { scrollY };
};

/**
 * Custom hook for responsive logo animation with scroll
 * @param {Object} options - Configuration options
 * @returns {Object} - Logo style object and animation state
 */
export const useLogoAnimation = (options = {}) => {
  const {
    maxScroll: customMaxScroll,
    minSize: customMinSize,
    maxSize: customMaxSize,
    enabled = true
  } = options;

  const [logoStyle, setLogoStyle] = useState({
    height: '400px',
    opacity: 1,
    transform: 'translate3d(0, 0, 0)',
  });

  const { scrollY } = useScrollAnimation({ enabled });

  useEffect(() => {
    if (!enabled) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Responsive calculations
    const maxScroll = customMaxScroll || Math.min(300, viewportHeight * 0.45);
    const minSize = customMinSize || Math.max(48, viewportWidth * 0.08);
    const maxSize = customMaxSize || Math.min(350, viewportWidth * 0.35, viewportHeight * 0.4);

    const progress = Math.min(1, scrollY / maxScroll);
    const newHeight = maxSize - (progress * (maxSize - minSize));
    
    // Smoother opacity transition
    const opacity = Math.max(0, 1 - (progress * 1.2));
    
    // Responsive translation calculations
    const translateXBase = viewportWidth < 768 ? viewportWidth * 0.3 : viewportWidth * 0.4;
    const translateYBase = viewportHeight < 600 ? viewportHeight * 0.3 : viewportHeight * 0.35;
    
    const translateX = -progress * translateXBase;
    const translateY = -progress * translateYBase;

    setLogoStyle({
      height: `${newHeight}px`,
      opacity,
      transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
    });
  }, [scrollY, enabled, customMaxScroll, customMinSize, customMaxSize]);

  // Handle resize
  useEffect(() => {
    if (!enabled) return;

    const handleResize = () => {
      // Trigger recalculation on resize
      const event = new Event('scroll');
      window.dispatchEvent(event);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [enabled]);

  return { logoStyle };
};

/**
 * Custom hook for navbar animation with scroll
 * @param {boolean} isHomePage - Whether current page is home page
 * @returns {Object} - Navbar style object
 */
export const useNavbarAnimation = (isHomePage = false) => {
  const [navbarStyle, setNavbarStyle] = useState({
    opacity: isHomePage ? 0 : 1,
    transform: 'translate3d(0, 0, 0)',
  });

  const { scrollY } = useScrollAnimation({ enabled: isHomePage });

  useEffect(() => {
    if (!isHomePage) {
      setNavbarStyle({
        opacity: 1,
        transform: 'translate3d(0, 0, 0)',
      });
      return;
    }

    const maxScroll = Math.min(300, window.innerHeight * 0.45);
    const progress = Math.min(1, scrollY / maxScroll);
    
    // Start appearing when progress is > 0.65 (65% scrolled) for smoother transition
    const adjustedProgress = Math.max(0, (progress - 0.65) / 0.35);
    const opacity = Math.min(1, adjustedProgress * 1.2);

    setNavbarStyle({
      opacity,
      transform: 'translate3d(0, 0, 0)',
    });
  }, [scrollY, isHomePage]);

  return { navbarStyle };
};