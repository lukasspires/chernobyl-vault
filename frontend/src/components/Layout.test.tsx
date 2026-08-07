import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { useAppStore } from '../store';

describe('Chernobyl Vault layout', () => {
  beforeEach(() => {
    useAppStore.setState({ theme: 'light' });
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  it('renders the new brand and accessible navigation', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<p>Biblioteca de teste</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const home = screen.getByRole('link', { name: /Chernobyl Vault/ });
    expect(home).toHaveAttribute('href', '/');
    expect(home.querySelector('img')).toHaveAttribute('src', '/brand-mark.svg');
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getByText('Stories from the Exclusion Zone')).toBeInTheDocument();
  });
});
