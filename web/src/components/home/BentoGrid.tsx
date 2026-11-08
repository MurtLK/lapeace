/*
 * Adapted from Magic UI Bento Grid (Dillion Verma)
 * Catalog: https://21st.dev/@dillionverma/components/bento-grid
 * Upstream registry: https://magicui.design/r/bento-grid.json
 * Retained source: docs/design/vendor/21st-magicui-bento-grid.tsx
 *
 * MIT License
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

import { type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

function joinClasses(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}

export interface BentoGridProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
  className?: string;
}

export interface BentoCardProps extends ComponentPropsWithoutRef<'article'> {
  name: string;
  className?: string;
  background?: ReactNode;
  Icon: ElementType;
  description: string;
  href?: string;
  cta?: string;
  children?: ReactNode;
}

export const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div className={joinClasses('lp-bento-grid', className)} {...props}>
      {children}
    </div>
  );
};

export const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  children,
  ...props
}: BentoCardProps) => {
  return (
    <article
      className={joinClasses('lp-bento-card', className)}
      {...props}
    >
      {background ? <div className="lp-bento-card__bg">{background}</div> : null}

      <div className="lp-bento-card__body">
        <div className="lp-bento-card__header">
          <div className="lp-bento-card__icon-wrap" aria-hidden="true">
            <Icon className="lp-bento-card__icon" aria-hidden="true" />
          </div>
          <h3 className="lp-bento-card__title">{name}</h3>
          <p className="lp-bento-card__description">{description}</p>
        </div>

        {children ? <div className="lp-bento-card__content">{children}</div> : null}
      </div>

      {href && cta ? (
        <div className="lp-bento-card__footer">
          <a href={href} className="lp-bento-card__cta">
            <span>{cta}</span>
            <ArrowRight className="lp-icon" aria-hidden="true" />
          </a>
        </div>
      ) : null}
    </article>
  );
};
