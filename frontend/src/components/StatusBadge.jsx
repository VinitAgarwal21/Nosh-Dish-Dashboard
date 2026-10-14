import React from 'react';

/**
 * StatusBadge component
 * Displays published status, version, or unsaved indicators.
 */
export function StatusBadge({ type, label, version }) {
  if (type === 'version') {
    return (
      <span className="badge badge--version" title={`Database version ${version}`}>
        v{version}
      </span>
    );
  }

  if (type === 'unsaved') {
    return (
      <span className="badge badge--unsaved" title="Changes not yet saved to server">
        <span className="badge-dot badge-dot--amber" />
        Unsaved changes
      </span>
    );
  }

  if (type === 'success') {
    return (
      <span className="badge badge--success" title="Saved successfully to server">
        <span className="badge-dot badge-dot--green" />
        {label || 'Saved'}
      </span>
    );
  }

  if (type === 'published') {
    return (
      <span className="badge badge--published" title="Visible on public menu">
        <span className="badge-dot badge-dot--green" />
        Published
      </span>
    );
  }

  // Draft status
  return (
    <span className="badge badge--draft" title="Draft dish (hidden from public)">
      <span className="badge-dot badge-dot--gray" />
      Draft
    </span>
  );
}

export default StatusBadge;
