import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
const landscapes = ['/images/big-sur.jpeg', '/images/kings-canyon.jpeg', '/images/borrego-springs.jpeg', '/images/dragon.jpeg'];
export default function LandscapeBackground({ active = 0, timed = false }) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!timed || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setSlide(value => (value + 1) % landscapes.length), 6000);
    return () => window.clearInterval(timer);
  }, [timed, paused]);
  return <><div className="landscape-background" aria-hidden="true">{landscapes.map((src, index) => <img key={src} src={src} alt="" className={index === (timed ? slide : active) ? 'is-active' : ''} />)}<div className="landscape-shade" /></div>
    {timed && <div className="slideshow-controls"><button type="button" onClick={() => setPaused(!paused)}>{paused ? 'Play slideshow' : 'Pause slideshow'}</button>{landscapes.map((src, index) => <button key={src} type="button" aria-label={`Show landscape ${index + 1}`} aria-pressed={slide === index} onClick={() => { setSlide(index); setPaused(true); }}>{index + 1}</button>)}</div>}</>;
}
LandscapeBackground.propTypes = { active: PropTypes.number, timed: PropTypes.bool };

