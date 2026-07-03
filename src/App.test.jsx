import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const videosFixture = Array.from({ length: 9 }, (_, index) => ({
  nome: `video-${String(index + 1).padStart(2, '0')}`,
  categorias: index % 2 === 0 ? ['2d'] : ['3d'],
  url_video: `https://example.com/video-${index + 1}.mp4`,
  url_thumbnail: `https://example.com/thumb-${index + 1}.webp`,
}));

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => videosFixture,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the player controls and filters videos by category', async () => {
    render(<App />);

    expect((await screen.findAllByText(/video-01/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /primeira/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /última/i })).toBeInTheDocument();

    const categoryButton = screen.getByRole('button', { name: /2d/i });
    fireEvent.click(categoryButton);

    await waitFor(() => {
      expect(screen.queryByText(/video-01/i)).not.toBeInTheDocument();
    });
  });

  it('paginates the gallery with up to 8 items per page', async () => {
    render(<App />);

    expect(await screen.findByRole('button', { name: /video-01/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /video-09/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /próxima página/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /video-09/i })).toBeInTheDocument();
    });
  });

  it('starts the next video automatically when advancing', async () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    render(<App />);

    await screen.findAllByText(/video-01/i);
    const nextButton = document.getElementById('next-button');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalled();
    });
  });
});
