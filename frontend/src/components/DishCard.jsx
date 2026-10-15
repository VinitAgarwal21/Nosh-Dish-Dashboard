import React, { useState } from 'react';
import { useDishDraft } from '../hooks/useDishDraft';
import StatusBadge from './StatusBadge';
import ToggleSwitch from './ToggleSwitch';
import ErrorBanner from './ErrorBanner';

// Fallback image SVG as data URI when image fails to load or is invalid
const FALLBACK_IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='260' viewBox='0 0 400 260' fill='%23f1f5f9'%3E%3Crect width='400' height='260' fill='%23f8fafc'/%3E%3Cpath d='M160 140c0-22.09 17.91-40 40-40s40 17.91 40 40H160z' fill='%23cbd5e1'/%3E%3Cpath d='M150 148h100c0 16.57-13.43 30-30 30h-40c-16.57 0-30-13.43-30-30z' fill='%2394a3b8'/%3E%3Ccircle cx='200' cy='90' r='5' fill='%2364748b'/%3E%3Ctext x='50%25' y='210' text-anchor='middle' font-family='sans-serif' font-size='13' fill='%2364748b'%3EImage unavailable%3C/text%3E%3C/svg%3E";

export function DishCard({
  dish,
  newerServerDish,
  onSaveSuccess,
  onReloadDish,
  onViewDish,
  onDirtyChange,
}) {
  const [imageError, setImageError] = useState(false);

  // Reset image error if URL changes
  React.useEffect(() => {
    setImageError(false);
  }, [dish.imageUrl]);

  const {
    draftName,
    draftPublished,
    isDirty,
    isSaving,
    inlineError,
    conflictData,
    justSavedVersion,
    handleNameChange,
    handlePublishedChange,
    discardDraft,
    saveDraft,
    reloadLatest,
  } = useDishDraft(dish, {
    onSaveSuccess,
    onReloadDish,
  });

  // Notify parent of dirty/draft state for polling decisions
  React.useEffect(() => {
    onDirtyChange?.(dish.dishId, isDirty);
    return () => {
      onDirtyChange?.(dish.dishId, false);
    };
  }, [dish.dishId, isDirty, onDirtyChange]);

  const hasServerUpdate =
    isDirty &&
    newerServerDish &&
    newerServerDish.version > dish.version;

  return (
    <article
      className={`card ${isDirty ? 'card--dirty' : ''}`}
      aria-label={`Dish card for ${dish.dishName}`}
    >
      {/* Card Media Header */}
      <div className="card__media">
        <img
          src={imageError || !dish.imageUrl ? FALLBACK_IMAGE_DATA_URI : dish.imageUrl}
          alt={dish.dishName || 'Dish image'}
          className="card__image"
          onError={(e) => {
            e.currentTarget.onerror = null;
            setImageError(true);
          }}
          loading="lazy"
        />

        {/* Top Floating Badges */}
        <div className="card__badges-overlay">
          <div className="card__badges-left">
            <span
              className={`badge badge--id ${onViewDish ? 'badge--clickable' : ''}`}
              onClick={() => onViewDish && onViewDish(dish.dishId)}
              title={onViewDish ? `View dish page /dishes/${dish.dishId}` : `Dish #${dish.dishId}`}
            >
              #{dish.dishId} {onViewDish ? '↗' : ''}
            </span>
            <StatusBadge type="version" version={dish.version} />
          </div>
          <div className="card__badges-right">
            {justSavedVersion && <StatusBadge type="success" label={`Saved v${justSavedVersion}`} />}
            {isDirty && <StatusBadge type="unsaved" />}
            <StatusBadge type={draftPublished ? 'published' : 'draft'} />
          </div>
        </div>
      </div>

      {/* Card Content & Form */}
      <div className="card__content">
        {/* Name input */}
        <div className="form-group">
          <label htmlFor={`dish-name-${dish.dishId}`} className="form-label">
            Dish Name
          </label>
          <input
            id={`dish-name-${dish.dishId}`}
            type="text"
            className="form-input"
            value={draftName}
            disabled={isSaving}
            placeholder="Enter dish name"
            onChange={(e) => handleNameChange(e.target.value)}
          />
          {draftName !== dish.dishName && (
            <span className="form-diff">
              <span className="form-diff__tag">Unsaved</span>
              <span className="form-diff__text">Saved: &ldquo;{dish.dishName}&rdquo;</span>
            </span>
          )}
        </div>

        {/* Published Toggle */}
        <div className="card__toggle-row">
          <ToggleSwitch
            id={`publish-toggle-${dish.dishId}`}
            checked={draftPublished}
            disabled={isSaving}
            label={draftPublished ? 'Published on Menu' : 'Unpublished (Draft)'}
            onChange={handlePublishedChange}
          />
        </div>
        {draftPublished !== dish.isPublished && (
          <span className="form-diff">
            <span className="form-diff__tag">Unsaved</span>
            <span className="form-diff__text">Saved: {dish.isPublished ? 'Published' : 'Unpublished'}</span>
          </span>
        )}

        {/* External newer version banner (polled in background while user has draft) */}
        {hasServerUpdate && !conflictData && (
          <ErrorBanner
            variant="info"
            title="External Update Available"
            message={`Another update saved this dish as v${newerServerDish.version} on the server. Discard your draft to load the latest.`}
            actionText="Reload latest (discards my draft)"
            onAction={() => reloadLatest(newerServerDish)}
          />
        )}

        {/* 409 Conflict Banner */}
        {conflictData && (
          <ErrorBanner
            variant="conflict"
            title="Conflict Detected (409)"
            message={`Another update occurred while editing. The dish on the server is now v${conflictData.currentDish?.version || 'latest'}${conflictData.currentDish?.dishName ? ` ("${conflictData.currentDish.dishName}")` : ''}. Your local draft is preserved. Reload to load the latest saved version.`}
            actionText="Reload latest (discards my draft)"
            onAction={() => reloadLatest(conflictData.currentDish)}
          />
        )}

        {/* Inline 400 / Network / 500 Error Banner */}
        {inlineError && !conflictData && (
          <ErrorBanner
            variant="error"
            title={inlineError.status === 400 ? 'Validation Error' : 'Save Error'}
            message={inlineError.message}
            details={inlineError.details}
          />
        )}

        {/* Action Buttons: Visible ONLY when dirty */}
        {isDirty && (
          <div className="card__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={discardDraft}
              disabled={isSaving}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveDraft}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="spinner spinner--sm" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default DishCard;
