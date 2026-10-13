import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDishes } from './services/api';
import DishGrid from './components/DishGrid';
import ErrorBanner from './components/ErrorBanner';

const POLL_INTERVAL_MS = 5000;

export function App() {
  const [dishes, setDishes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialError, setInitialError] = useState(null);

  // External update tracking (Bonus requirement)
  // Mapping of dishId -> newer dish object received from background polling
  const [newerServerDishesMap, setNewerServerDishesMap] = useState({});

  // Sync status: 'connected' | 'paused' | 'reconnecting'
  const [syncStatus, setSyncStatus] = useState('connected');

  const pollTimerRef = useRef(null);
  const dishesRef = useRef(dishes);
  dishesRef.current = dishes;

  // Initial load
  const loadInitialDishes = useCallback(async () => {
    setIsLoading(true);
    setInitialError(null);
    try {
      const data = await getDishes();
      setDishes(data);
      setNewerServerDishesMap({});
      setSyncStatus('connected');
    } catch (err) {
      setInitialError(err.message || 'Failed to load dishes from backend server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialDishes();
  }, [loadInitialDishes]);

  // Background polling function (Bonus requirement)
  const pollServer = useCallback(async () => {
    // Only poll if tab is visible and initial load was successful
    if (document.visibilityState === 'hidden') {
      setSyncStatus('paused');
      return;
    }

    try {
      const serverDishes = await getDishes();
      setSyncStatus('connected');

      // Map incoming dishes against current local dishes
      setNewerServerDishesMap((prevNewerMap) => {
        const updatedNewerMap = { ...prevNewerMap };

        setDishes((currentLocalDishes) => {
          return currentLocalDishes.map((localDish) => {
            const incoming = serverDishes.find((s) => s.dishId === localDish.dishId);
            if (!incoming) return localDish;

            // If server has a newer version
            if (incoming.version > localDish.version) {
              // Register in newerServerDishesMap so dirty cards can show notice
              updatedNewerMap[localDish.dishId] = incoming;
              return localDish;
            }

            // If version is identical, clear any obsolete notice
            if (incoming.version === localDish.version) {
              delete updatedNewerMap[localDish.dishId];
            }

            return localDish;
          });
        });

        return updatedNewerMap;
      });
    } catch {
      // Graceful error handling for background polling (temporary disconnection)
      setSyncStatus('reconnecting');
    }
  }, []);

  // Polling lifecycle & visibility change handling
  useEffect(() => {
    if (isLoading || initialError) return;

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
        pollServer(); // Poll immediately when tab becomes visible again
        startPolling();
      }
    }

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading, initialError, pollServer]);

  // Handle successful save from a DishCard
  const handleSaveSuccess = useCallback((savedDish) => {
    setDishes((prev) =>
      prev.map((d) => (d.dishId === savedDish.dishId ? savedDish : d))
    );
    // Remove from newer map since local card is now up-to-date with server
    setNewerServerDishesMap((prev) => {
      const copy = { ...prev };
      delete copy[savedDish.dishId];
      return copy;
    });
  }, []);

  // Handle reload dish (when user clicks reload latest after conflict or external update)
  const handleReloadDish = useCallback((reloadedDish) => {
    setDishes((prev) =>
      prev.map((d) => (d.dishId === reloadedDish.dishId ? reloadedDish : d))
    );
    setNewerServerDishesMap((prev) => {
      const copy = { ...prev };
      delete copy[reloadedDish.dishId];
      return copy;
    });
  }, []);

  const totalDishes = dishes.length;
  const publishedDishes = dishes.filter((d) => d.isPublished).length;

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="app-header__top">
          <div className="app-header__title-group">
            <h1 className="app-header__title">Nosh Dish Dashboard</h1>
            <p className="app-header__subtitle">
              Draft editing, optimistic concurrency control &amp; live sync
            </p>
          </div>

          <div className="app-header__meta">
            {/* Live sync status pill */}
            <div className="sync-pill" title="Background polling every 5s; pauses when tab is inactive">
              <span
                className={`sync-pill__dot ${
                  syncStatus === 'paused'
                    ? 'sync-pill__dot--paused'
                    : syncStatus === 'reconnecting'
                    ? 'sync-pill__dot--reconnecting'
                    : ''
                }`}
              />
              {syncStatus === 'paused' && 'Sync paused'}
              {syncStatus === 'reconnecting' && 'Reconnecting...'}
              {syncStatus === 'connected' && 'Live sync active'}
            </div>

            {/* Counts */}
            <span className="stat-chip">
              {publishedDishes} / {totalDishes} Published
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {initialError ? (
          <ErrorBanner
            variant="fullpage"
            title="Connection Error"
            message={initialError}
            actionText="Retry Connection"
            onAction={loadInitialDishes}
          />
        ) : (
          <DishGrid
            dishes={dishes}
            newerServerDishesMap={newerServerDishesMap}
            isLoading={isLoading}
            onSaveSuccess={handleSaveSuccess}
            onReloadDish={handleReloadDish}
          />
        )}
      </main>
    </div>
  );
}

export default App;
