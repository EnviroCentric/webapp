import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isServicePath, slideForPath, serviceSlides } from '../data/serviceSlides';
export default function LandscapeBackground() {
  const { pathname } = useLocation();
  const slide = isServicePath(pathname.replace(/\/$/, '')) ? slideForPath(pathname) : null;
  const requested = slide?.image || '/big-sur.jpg';
  const [shown, setShown] = useState(requested);
  const [images, setImages] = useState([requested]);
  const loaded = useRef(new Set());
  useEffect(() => {
    setImages(current => current.includes(requested) ? current : [...current, requested]);
    if (loaded.current.has(requested)) setShown(requested);
  }, [requested]);
  // Keep the previous photo visible until the incoming image has loaded.
  return <div className={`landscape-background${slide ? ' service-landscape' : ''}`} aria-hidden="true">
    {images.map(src => <img key={src} src={src} alt="" className={shown === src ? 'is-active' : ''} style={{ objectPosition: serviceSlides.find(item => item.image === src)?.position }} onLoad={() => { loaded.current.add(src); if (src === requested) setShown(src); }} />)}
    <div className="landscape-shade" />
  </div>;
}
