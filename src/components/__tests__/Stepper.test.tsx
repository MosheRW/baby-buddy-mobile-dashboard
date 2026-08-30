import React from 'react';
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Stepper } from '../Stepper';

/**
 * The stepper edits in place: tapping the number swaps it for a text field
 * between the ± buttons (no pop-up dialog), and that field auto-focuses so the
 * keyboard opens without a second tap.
 *
 * RNTL 14 on React 19 renders asynchronously, so `render` is awaited and queries
 * go through the global `screen`. Elements are re-queried after every state
 * change — a controlled input's node is replaced on re-render, and firing an
 * event on a stale reference would run the previous render's handler closure.
 */
afterEach(cleanup);

describe('Stepper inline editing', () => {
  it('shows the value as a label until tapped, then an auto-focused inline input', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={5} onChange={onChange} step={1} min={0} max={100} />);

    // Before tapping: the number is a label, not an editable field.
    expect(screen.queryByDisplayValue('5')).toBeNull();

    fireEvent.press(screen.getByLabelText('Edit value'));

    const input = await screen.findByDisplayValue('5');
    // The keyboard must open on its own — no extra click.
    expect(input.props.autoFocus).toBe(true);
  });

  it('commits a typed value through onChange on submit', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={5} onChange={onChange} step={1} min={0} max={100} />);

    fireEvent.press(screen.getByLabelText('Edit value'));
    fireEvent.changeText(await screen.findByDisplayValue('5'), '42');
    fireEvent(await screen.findByDisplayValue('42'), 'submitEditing');

    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('rejects an out-of-range entry, restoring the mount value', async () => {
    const onChange = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<Stepper value={5} onChange={onChange} step={1} min={0} max={100} />);

    fireEvent.press(screen.getByLabelText('Edit value'));
    fireEvent.changeText(await screen.findByDisplayValue('5'), '999');
    fireEvent(await screen.findByDisplayValue('999'), 'submitEditing');

    expect(alert).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(5);
    alert.mockRestore();
  });

  it('opens two auto-focused fields for the hours+minutes editor', async () => {
    const onChange = jest.fn();
    await render(
      <Stepper
        value={90}
        onChange={onChange}
        step={1}
        min={0}
        hoursMinutes
        format={(m) => `${Math.floor(m / 60)}h ${m % 60}m`}
      />,
    );

    fireEvent.press(screen.getByLabelText('Edit value'));

    // splitMinutes(90) → 1h 30m, typed as two separate boxes.
    const hours = await screen.findByLabelText('Hours');
    const minutes = screen.getByLabelText('Minutes');
    expect(hours.props.value).toBe('1');
    expect(minutes.props.value).toBe('30');
    expect(hours.props.autoFocus).toBe(true);
  });
});
