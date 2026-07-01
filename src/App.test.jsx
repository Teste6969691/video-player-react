import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const videosFixture = [
  {
    nome: '4632554.mov720',
    categoria: '2d',
    url_video: 'https://example.com/video-1.mp4',
    url_thumbnail: 'https://example.com/thumb-1.webp',
  },
  {
    nome: '4632555.mov720',
    categoria: '3d',
    url_video: 'https://example.com/video-2.mp4',
    url_thumbnail: 'https://example.com/thumb-2.webp',
  },
];

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => videosFixture,
    }));
  });

  it('renders the player controls and filters videos by category', async () => {
    render(<App />);

    expect((await screen.findAllByText(/4632554\.mov720/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /primeira/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /última/i })).toBeInTheDocument();

    const categorySelect = screen.getByLabelText(/categorias/i);
    fireEvent.change(categorySelect, { target: { value: '3d' } });

    await waitFor(() => {
      expect(screen.queryByText(/4632554\.mov720/i)).not.toBeInTheDocument();
    });
  });
});
