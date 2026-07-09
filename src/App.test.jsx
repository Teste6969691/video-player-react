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

  it('filters videos by requiring all selected categories', async () => {
    render(<App />);

    expect((await screen.findAllByText(/video-01/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /primeira/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /última/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /selecionar categoria 2d/i }));
    fireEvent.click(screen.getByRole('button', { name: /selecionar categoria 3d/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /video-01/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /video-02/i })).not.toBeInTheDocument();
    });
  });

  it('blocks videos that belong to a blacklisted category', async () => {
    render(<App />);

    expect(await screen.findByRole('button', { name: /video-01/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /bloquear categoria 2d/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /video-01/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /video-02/i })).toBeInTheDocument();
    });
  });

  it('filters videos using the new categories field from data.json', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { nome: 'video-new-1', categories: ['2d'], url_video: 'https://example.com/new-1.mp4', url_thumbnail: 'https://example.com/new-1.webp' },
        { nome: 'video-new-2', categories: ['3d'], url_video: 'https://example.com/new-2.mp4', url_thumbnail: 'https://example.com/new-2.webp' },
      ],
    }));

    render(<App />);

    expect(await screen.findByRole('button', { name: /video-new-1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /selecionar categoria 2d/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /video-new-1/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /video-new-2/i })).not.toBeInTheDocument();
    });
  });

  it('filters videos by authors and tags in separate metadata sections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { nome: 'video-meta-1', categories: ['2d'], authors: ['Ana'], tags: ['anime'], url_video: 'https://example.com/meta-1.mp4', url_thumbnail: 'https://example.com/meta-1.webp' },
        { nome: 'video-meta-2', categories: ['3d'], authors: ['Bruno'], tags: ['loop'], url_video: 'https://example.com/meta-2.mp4', url_thumbnail: 'https://example.com/meta-2.webp' },
        { nome: 'video-meta-3', categories: ['2d'], authors: ['Ana'], tags: ['loop'], url_video: 'https://example.com/meta-3.mp4', url_thumbnail: 'https://example.com/meta-3.webp' },
      ],
    }));

    render(<App />);

    expect(await screen.findByRole('button', { name: /video-meta-1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /selecionar autor ana/i }));
    fireEvent.click(screen.getByRole('button', { name: /selecionar tag loop/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /video-meta-3/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /video-meta-1/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /video-meta-2/i })).not.toBeInTheDocument();
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
