import React from 'react';

/**
 * ToggleSwitch component
 * Accessible, pure CSS styled toggle switch.
 */
export function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled = false,
  label = 'Published status',
}) {
  return (
    <label htmlFor={id} className={`toggle-container ${disabled ? 'toggle-container--disabled' : ''}`}>
      <span className="toggle-label">{label}</span>
      <div className="toggle-switch-wrapper">
        <input
          type="checkbox"
          id={id}
          className="toggle-checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
        />
        <span className="toggle-slider" />
      </div>
    </label>
  );
}

export default ToggleSwitch;
