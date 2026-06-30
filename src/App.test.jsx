import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the player controls and pagination', () => {
    render(<App />);

    expect(screen.getByText(/Video 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /primeira/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /última/i })).toBeInTheDocument();
  });
});
