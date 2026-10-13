import { useState, useEffect, useCallback } from 'react';
import { updateDish } from '../services/api';

/**
 * Custom hook to manage per-dish draft editing, dirty checking,
 * explicit saving, discarding, and conflict/error resolution.
 *
 * @param {Object} savedDish - Current saved dish state from backend
 * @param {Object} options
 * @param {Function} options.onSaveSuccess - Invoked when PATCH succeeds
 * @param {Function} options.onReloadDish - Invoked when user discards draft and reloads server version
 */
export function useDishDraft(savedDish, { onSaveSuccess, onReloadDish }) {
  const [draftName, setDraftName] = useState(savedDish.dishName);
  const [draftPublished, setDraftPublished] = useState(savedDish.isPublished);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineError, setInlineError] = useState(null);
  const [conflictData, setConflictData] = useState(null);

  // Synchronize draft state if savedDish changes from outside while user has NOT made edits
  const isDirty = draftName !== savedDish.dishName || draftPublished !== savedDish.isPublished;

  useEffect(() => {
    if (!isDirty) {
      setDraftName(savedDish.dishName);
      setDraftPublished(savedDish.isPublished);
    }
  }, [savedDish.dishName, savedDish.isPublished, savedDish.version, isDirty]);

  // Discard draft and reset to last loaded values
  const discardDraft = useCallback(() => {
    setDraftName(savedDish.dishName);
    setDraftPublished(savedDish.isPublished);
    setInlineError(null);
    setConflictData(null);
  }, [savedDish.dishName, savedDish.isPublished]);

  // Handle name input change
  const handleNameChange = useCallback((name) => {
    setDraftName(name);
    // Clear inline error when user edits
    if (inlineError) {
      setInlineError(null);
    }
  }, [inlineError]);

  // Handle published toggle change
  const handlePublishedChange = useCallback((published) => {
    setDraftPublished(published);
    if (inlineError) {
      setInlineError(null);
    }
  }, [inlineError]);

  // Save draft changes using ORIGINALLY LOADED expectedVersion
  const saveDraft = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setInlineError(null);
    setConflictData(null);

    try {
      const updated = await updateDish(savedDish.dishId, {
        dishName: draftName,
        isPublished: draftPublished,
        expectedVersion: savedDish.version,
      });

      // Update draft values to match server's returned (trimmed) values
      setDraftName(updated.dishName);
      setDraftPublished(updated.isPublished);
      setInlineError(null);
      setConflictData(null);

      if (onSaveSuccess) {
        onSaveSuccess(updated);
      }
    } catch (err) {
      if (err.status === 409) {
        // Optimistic locking conflict
        setConflictData({
          currentDish: err.currentDish,
          message: err.message,
        });
      } else {
        // Validation (400), Network (0), or Server error (500)
        setInlineError({
          status: err.status,
          message: err.message || 'An error occurred while saving.',
          details: err.details || null,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, savedDish.dishId, savedDish.version, draftName, draftPublished, onSaveSuccess]);

  // Reload the latest server dish, discarding local draft
  const reloadLatest = useCallback((newerDish) => {
    const target = newerDish || conflictData?.currentDish;
    if (target) {
      setDraftName(target.dishName);
      setDraftPublished(target.isPublished);
      setConflictData(null);
      setInlineError(null);
      if (onReloadDish) {
        onReloadDish(target);
      }
    }
  }, [conflictData, onReloadDish]);

  return {
    draftName,
    draftPublished,
    isDirty,
    isSaving,
    inlineError,
    conflictData,
    handleNameChange,
    handlePublishedChange,
    discardDraft,
    saveDraft,
    reloadLatest,
  };
}
