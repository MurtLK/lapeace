/*
 * Adapted from https://magicui.design/r/shimmer-button.json
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

import { type ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import './shimmer-button.css';

// Navigation stays a real link; the upstream spark, backdrop and highlight are decorative.
export function ShimmerButton({ children, className = '', ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={`lp-btn lp-shimmer-button ${className}`}>
      <span className="lp-shimmer-button__spark-container" aria-hidden="true">
        <span className="lp-shimmer-button__spark" />
      </span>
      <span className="lp-shimmer-button__backdrop" aria-hidden="true" />
      <span className="lp-shimmer-button__content">{children}</span>
      <span className="lp-shimmer-button__highlight" aria-hidden="true" />
    </Link>
  );
}
