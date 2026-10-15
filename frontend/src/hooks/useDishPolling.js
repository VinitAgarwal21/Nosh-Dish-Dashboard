import { useState, useEffect, useCallback, useRef } from 'react';
import { getDishes, getDish } from '../services/api';

const POLL_INTERVAL_MS = 5000;

/**
 * Custom hook to manage background polling, real-time synchronization,
 * auto-refresh for cards without drafts, conflict notification for cards with drafts,
 * visibility change pausing, and network disconnection recovery.
 */
export function useDishPolling({
  isDishes,
  isSingleDish,
  singleDishId,
  isLoading,
  initialError,
  singleDishError,
  dishes,
  setDishes,
  singleDish,
  setSingleDish,
  dirtyDishIdsRef,
}) {
  const [syncStatus, setSyncStatus] = useState('connected');
  const [newerServerDishesMap, setNewerServerDishesMap] = useState({});
  const pollTimerRef = useRef(null);

  const dishesRef = useRef(dishes);
  dishesRef.current = dishes;

  const singleDishRef = useRef(singleDish);
  singleDishRef.current = singleDish;

  const pollServer = useCallback(async () => {
    if (document.visibilityState === 'hidden') {
      setSyncStatus('paused');
      return;
    }

    try {
      if (isDishes) {
        const serverDishes = await getDishes();
        setSyncStatus('connected');

        const currentLocalDishes = dishesRef.current;
        const currentDirtyIds = dirtyDishIdsRef.current || new Set();

        const nextNewerMap = {};
        const nextDishes = serverDishes.map((incoming) => {
          const localDish = currentLocalDishes.find((d) => d.dishId === incoming.dishId);
          if (!localDish) {
            return incoming;
          }

          const hasDraft = currentDirtyIds.has(incoming.dishId);

          if (incoming.version > localDish.version) {
            if (hasDraft) {
              // Card has active unsaved draft: preserve local draft, flag newer server version
              nextNewerMap[incoming.dishId] = incoming;
              return localDish;
            }
            // Card has NO draft: automatically refresh on screen with latest server data
            return incoming;
          }

          // Local version is current or newer
          return localDish;
        });

        // Update states separately (avoid calling setDishes inside setNewerServerDishesMap)
        setDishes(nextDishes);
        setNewerServerDishesMap(nextNewerMap);
      } else if (isSingleDish && singleDishId) {
        const incoming = await getDish(singleDishId);
        setSyncStatus('connected');

        const current = singleDishRef.current;
        const hasDraft = dirtyDishIdsRef.current?.has(singleDishId);

        if (current && incoming.version > current.version) {
          if (hasDraft) {
            // Card has active draft: preserve local draft, flag newer server version
            setNewerServerDishesMap({ [singleDishId]: incoming });
          } else {
            // Card has NO draft: automatically refresh on screen
            setSingleDish(incoming);
            setDishes((prev) =>
              prev.map((d) => (d.dishId === incoming.dishId ? incoming : d))
            );
            setNewerServerDishesMap({});
          }
        } else if (current && incoming.version === current.version) {
          setNewerServerDishesMap({});
        }
      }
    } catch {
      // Temporary network disconnection or server downtime
      setSyncStatus('reconnecting');
    }
  }, [isDishes, isSingleDish, singleDishId, setDishes, setSingleDish, dirtyDishIdsRef]);

  // Polling lifecycle: active on /dishes or /dishes/:dishId
  useEffect(() => {
    if ((!isDishes && !isSingleDish) || isLoading || initialError || singleDishError) return;

    function startPolling() {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(pollServer, POLL_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        setSyncStatus('paused');
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      } else {
        setSyncStatus('connected');
        pollServer();
        startPolling();
      }
    }

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDishes, isSingleDish, isLoading, initialError, singleDishError, pollServer]);

  return {
    syncStatus,
    newerServerDishesMap,
    setNewerServerDishesMap,
    pollServer,
  };
}

export default useDishPolling;
