// components/PullToRefresh.js
'use client';

import { useState, useEffect, useRef } from 'react';

const PULL_THRESHOLD = 68; // px dragged down needed to trigger refresh
const MAX_PULL = 92; // max px indicator can be pulled down
const RESTING_DISTANCE = 56; // px indicator rests during refresh animation

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle' | 'pulling' | 'ready' | 'refreshing'
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const statusRef = useRef('idle');
  const pullDistanceRef = useRef(0);
  const hasVibratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper: Determine if user touch is inside an active modal, form input, or scrollable child container
    const isInteractiveOrScrolledChild = (target) => {
      if (!target || !(target instanceof Element)) return false;

      // Ignore if inside an open modal or dialog
      if (target.closest('.modal-overlay, .modal-content, [role="dialog"]')) {
        return true;
      }

      // Ignore if interacting with form controls or editable areas
      if (target.closest('input, textarea, select, [contenteditable="true"]')) {
        return true;
      }

      // Ignore if inside an inner container that is scrolled down
      let el = target;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollTop > 0) {
          return true;
        }
        el = el.parentElement;
      }

      return false;
    };

    // ── TOUCH GESTURE HANDLERS ──
    const handleTouchStart = (e) => {
      if (statusRef.current === 'refreshing') return;
      if (!e.touches || e.touches.length !== 1) return;

      // Only allow pull-to-refresh if user is at the very top of the window
      const isAtTop = window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
      if (!isAtTop) {
        isPullingRef.current = false;
        return;
      }

      if (isInteractiveOrScrolledChild(e.target)) {
        isPullingRef.current = false;
        return;
      }

      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isPullingRef.current = true;
      hasVibratedRef.current = false;
    };

    const handleTouchMove = (e) => {
      if (!isPullingRef.current || statusRef.current === 'refreshing') return;
      if (!e.touches || e.touches.length !== 1) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = currentX - startXRef.current;

      // If user swipes horizontally more than vertically, treat as horizontal scroll (e.g. tabs/tables)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        isPullingRef.current = false;
        setIsPulling(false);
        setPullDistance(0);
        setStatus('idle');
        return;
      }

      // If user is scrolling down into the page
      if (deltaY < 0) {
        isPullingRef.current = false;
        setIsPulling(false);
        setPullDistance(0);
        setStatus('idle');
        return;
      }

      // If page was scrolled during gesture
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
        isPullingRef.current = false;
        setIsPulling(false);
        setPullDistance(0);
        setStatus('idle');
        return;
      }

      // Valid downward pull from top
      if (deltaY > 0) {
        // Prevent default browser overscroll / refresh conflict if cancelable
        if (e.cancelable) {
          e.preventDefault();
        }

        // Apply progressive damping resistance
        const damped = Math.min(MAX_PULL, deltaY * 0.42);
        pullDistanceRef.current = damped;
        setPullDistance(damped);
        setIsPulling(true);

        if (damped >= PULL_THRESHOLD) {
          if (statusRef.current !== 'ready') {
            statusRef.current = 'ready';
            setStatus('ready');
            if (!hasVibratedRef.current) {
              hasVibratedRef.current = true;
              if (window.navigator?.vibrate) {
                window.navigator.vibrate(15);
              }
            }
          }
        } else {
          if (statusRef.current !== 'pulling') {
            statusRef.current = 'pulling';
            setStatus('pulling');
            hasVibratedRef.current = false;
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current || statusRef.current === 'refreshing') return;
      isPullingRef.current = false;
      setIsPulling(false);

      if (statusRef.current === 'ready') {
        // Trigger page refresh
        statusRef.current = 'refreshing';
        setStatus('refreshing');
        setPullDistance(RESTING_DISTANCE);

        if (window.navigator?.vibrate) {
          window.navigator.vibrate([10, 40, 15]);
        }

        // Give a brief moment for the animation and refresh the page
        setTimeout(() => {
          window.location.reload();
        }, 380);
      } else {
        // Cancelled pull
        statusRef.current = 'idle';
        setStatus('idle');
        setPullDistance(0);
        hasVibratedRef.current = false;
      }
    };

    // Attach listeners with { passive: false } on touchmove so preventDefault works reliably
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  // When not active and idle, render hidden
  const isVisible = status !== 'idle' || pullDistance > 0;
  if (!isVisible && status === 'idle') return null;

  // Calculate translateY position for the floating pill
  // When idle: -60px (offscreen)
  // When pulling: smoothly descends from -50px down to resting/threshold
  const translateY = status === 'refreshing'
    ? 16
    : Math.max(-55, pullDistance - 50);

  const opacity = status === 'refreshing'
    ? 1
    : Math.min(1, Math.max(0, (pullDistance - 8) / 32));

  const rotation = status === 'ready'
    ? 180
    : Math.min(180, (pullDistance / PULL_THRESHOLD) * 180);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(max(8px, env(safe-area-inset-top, 8px)))',
        left: '50%',
        transform: `translateX(-50%) translateY(${translateY}px)`,
        zIndex: 99999999,
        pointerEvents: 'none',
        opacity: opacity,
        transition: isPulling ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
        willChange: 'transform, opacity',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 15px 7px 11px',
          borderRadius: '9999px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(24px) saturate(190%)',
          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
          border: '1px solid rgba(0, 0, 0, 0.09)',
          boxShadow: '0 8px 24px -2px rgba(0, 0, 0, 0.15), 0 2px 6px -1px rgba(0, 0, 0, 0.06)',
          userSelect: 'none',
        }}
      >
        {/* Icon Circle */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: status === 'ready' || status === 'refreshing' ? '#e0f2fe' : '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease',
            flexShrink: 0,
          }}
        >
          {status === 'refreshing' ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#007aff"
              strokeWidth="2.8"
              strokeLinecap="round"
              style={{ animation: 'spin 0.75s linear infinite' }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={status === 'ready' ? '#007aff' : '#64748b'}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isPulling ? 'transform 0.08s ease-out' : 'transform 0.22s ease',
              }}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          )}
        </div>

        {/* Status Text */}
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: status === 'ready' || status === 'refreshing' ? '#007aff' : '#334155',
            transition: 'color 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'refreshing'
            ? '새로고침 중...'
            : status === 'ready'
            ? '손을 떼면 새로고침'
            : '당겨서 새로고침'}
        </span>
      </div>
    </div>
  );
}
