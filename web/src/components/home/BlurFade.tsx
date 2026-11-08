/*
 * Adapted from https://magicui.design/r/blur-fade.json
 * Public 21st.dev catalog / Magic UI upstream registry.
 * Plain CSS/Web Animations adaptation for LaPeace.
 *
 * MIT License
 *
 * Copyright (c) Magic UI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

interface BlurFadeProps extends ComponentPropsWithoutRef<'div'> {
  duration?: number;
  delay?: number;
  offset?: number;
  blur?: string;
}

// Keep the upstream blur/offset/duration API with an always-visible base state.
export function BlurFade({ duration = 0.45, delay = 0, offset = 6, blur = '4px', children, ...props }: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    const animation = element.animate([
      { opacity: 0.65, transform: `translateY(${offset}px)`, filter: `blur(${blur})` },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
    ], { duration: duration * 1000, delay: delay * 1000, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    const onPreferenceChange = () => { if (reduced.matches) animation.cancel(); };
    reduced.addEventListener('change', onPreferenceChange);
    return () => { animation.cancel(); reduced.removeEventListener('change', onPreferenceChange); };
  }, [duration, delay, offset, blur]);
  return <div ref={ref} {...props}>{children}</div>;
}
