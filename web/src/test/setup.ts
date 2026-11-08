import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => undefined });
