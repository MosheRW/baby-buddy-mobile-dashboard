import React from 'react';
import { Text } from 'react-native';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';

/**
 * The root error boundary catches a render-time throw in any screen and shows a
 * themed "something went wrong / try again" fallback instead of blanking the
 * whole app (a release build has no dev redbox). i18n self-initializes on
 * import, so the English copy resolves with no provider mounted.
 */
afterEach(cleanup);

/** A child that throws on first render, then renders normally after a retry. */
function Flaky({ crashes }: { crashes: boolean }) {
  if (crashes) throw new Error('kaboom');
  return <Text>recovered</Text>;
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', async () => {
    await render(
      <ErrorBoundary>
        <Text>content</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('shows the fallback when a child throws', async () => {
    // React re-throws the caught error to console.error; our boundary logs a
    // console.warn. Silence both so the run stays clean.
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(
      <ErrorBoundary>
        <Flaky crashes />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();

    err.mockRestore();
    warn.mockRestore();
  });

  it('clears the error and re-renders children when Try again is pressed', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(
      <ErrorBoundary>
        <Flaky crashes />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    // Swap in a child that no longer throws. While in the error state the
    // boundary keeps showing the fallback and ignores the new children…
    screen.rerender(
      <ErrorBoundary>
        <Flaky crashes={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    // …until Try again resets it and re-renders the now-healthy subtree.
    fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('recovered')).toBeTruthy();

    err.mockRestore();
    warn.mockRestore();
  });
});
