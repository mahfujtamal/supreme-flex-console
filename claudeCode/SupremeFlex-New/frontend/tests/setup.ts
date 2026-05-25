import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter:   () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: unknown }) => children,
}));
