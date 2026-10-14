import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDishes, getDish } from './services/api';
import DishGrid from './components/DishGrid';
import DishCard from './components/DishCard';
import ErrorBanner from './components/ErrorBanner';

const POLL_INTERVAL_MS = 5000;

export function App() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  const normalizedPath = (currentPath || '/').replace(/\/+$/, '') || '/';
  const isHome = normalizedPath === '/';
  const isDishes = normalizedPath === '/dishes';

  // Support /dishes/:dishId route
  const singleDishMatch = normalizedPath.match(/^\/dishes\/([^/]+)$/);
  const isSingleDish = Boolean(singleDishMatch);
  const singleDishId = singleDishMatch ? decodeURIComponent(singleDishMatch[1]) : null;

  const isUnknownRoute = !isHome && !isDishes && !isSingleDish;

  const [dishes, setDishes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialError, setInitialError] = useState(null);

  // Single dish view state
  const [singleDish, setSingleDish] = useState(null);
  const [singleDishLoading, setSingleDishLoading] = useState(false);
  const [singleDishError, setSingleDishError] = useState(null);

  const [newerServerDishesMap, setNewerServerDishesMap] = useState({});
  const [syncStatus, setSyncStatus] = useState('connected');

  const pollTimerRef = useRef(null);
  const dishesRef = useRef(dishes);
  dishesRef.current = dishes;

  const singleDishRef = useRef(singleDish);
  singleDishRef.current = singleDish;

  // Load all dishes
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

  // When on /dishes, load all dishes
  useEffect(() => {
    if (isDishes) {
      loadInitialDishes();
    }
  }, [isDishes, loadInitialDishes]);

  // When on /dishes/:dishId, fetch that single dish
  useEffect(() => {
    if (isSingleDish && singleDishId) {
      const cached = dishesRef.current.find((d) => d.dishId === singleDishId);
      if (cached) {
        setSingleDish(cached);
      }

      setSingleDishLoading(!cached);
      setSingleDishError(null);

      getDish(singleDishId)
        .then((data) => {
          setSingleDish(data);
          setSingleDishError(null);
          setDishes((prev) => {
            const exists = prev.some((d) => d.dishId === data.dishId);
            if (exists) {
              return prev.map((d) => (d.dishId === data.dishId ? data : d));
            }
            return [...prev, data];
          });
        })
        .catch((err) => {
          setSingleDishError(err.message || `Dish with ID "${singleDishId}" not found`);
        })
        .finally(() => {
          setSingleDishLoading(false);
        });
    } else {
      setSingleDish(null);
      setSingleDishError(null);
    }
  }, [isSingleDish, singleDishId]);

  // Background polling for all dishes on /dishes
  const pollServer = useCallback(async () => {
    if (document.visibilityState === 'hidden') {
      setSyncStatus('paused');
      return;
    }

    try {
      if (isDishes) {
        const serverDishes = await getDishes();
        setSyncStatus('connected');

        setNewerServerDishesMap((prevNewerMap) => {
          const updatedNewerMap = { ...prevNewerMap };

          setDishes((currentLocalDishes) => {
            return currentLocalDishes.map((localDish) => {
              const incoming = serverDishes.find((s) => s.dishId === localDish.dishId);
              if (!incoming) return localDish;

              if (incoming.version > localDish.version) {
                updatedNewerMap[localDish.dishId] = incoming;
                return localDish;
              }

              if (incoming.version === localDish.version) {
                delete updatedNewerMap[localDish.dishId];
              }

              return localDish;
            });
          });

          return updatedNewerMap;
        });
      } else if (isSingleDish && singleDishId) {
        const incoming = await getDish(singleDishId);
        setSyncStatus('connected');

        setNewerServerDishesMap((prevNewerMap) => {
          const updatedNewerMap = { ...prevNewerMap };
          const current = singleDishRef.current;
          if (current && incoming.version > current.version) {
            updatedNewerMap[singleDishId] = incoming;
          } else if (current && incoming.version === current.version) {
            delete updatedNewerMap[singleDishId];
          }
          return updatedNewerMap;
        });
      }
    } catch {
      setSyncStatus('reconnecting');
    }
  }, [isDishes, isSingleDish, singleDishId]);

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

  // Handle successful save
  const handleSaveSuccess = useCallback((savedDish) => {
    setDishes((prev) =>
      prev.map((d) => (d.dishId === savedDish.dishId ? savedDish : d))
    );
    if (singleDishRef.current?.dishId === savedDish.dishId) {
      setSingleDish(savedDish);
    }
    setNewerServerDishesMap((prev) => {
      const copy = { ...prev };
      delete copy[savedDish.dishId];
      return copy;
    });
  }, []);

  // Handle reload dish
  const handleReloadDish = useCallback((reloadedDish) => {
    setDishes((prev) =>
      prev.map((d) => (d.dishId === reloadedDish.dishId ? reloadedDish : d))
    );
    if (singleDishRef.current?.dishId === reloadedDish.dishId) {
      setSingleDish(reloadedDish);
    }
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
            <h1
              className="app-header__title"
              style={{ cursor: 'pointer' }}
              onClick={() => navigateTo('/')}
              title="Return to Home"
            >
              Nosh Dish Dashboard
            </h1>
            <p className="app-header__subtitle">
              Draft editing, optimistic concurrency control &amp; live sync
            </p>
          </div>

          <div className="app-header__meta">
            {(isDishes || isSingleDish) && (
              <>
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
                {isDishes && (
                  <span className="stat-chip">
                    {publishedDishes} / {totalDishes} Published
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {/* Root Route: / */}
        {isHome && (
          <section className="home-hero">
            <div className="home-hero__badge">Nosh Restaurant Operations</div>
            <h2 className="home-hero__title">Dish Management System</h2>
            <p className="home-hero__description">
              View published dishes, edit dish names with instant local drafts, toggle publication status, and safely synchronize concurrent edits with optimistic locking.
            </p>
            <button
              type="button"
              id="btn-dishes"
              className="btn btn--primary btn--lg"
              onClick={() => navigateTo('/dishes')}
            >
              🍽️ Dishes
            </button>
          </section>
        )}

        {/* All Dishes Route: /dishes */}
        {isDishes && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="nav-back-btn"
                onClick={() => navigateTo('/')}
              >
                ← Back to Home
              </button>
            </div>

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
                onViewDish={(dishId) => navigateTo(`/dishes/${dishId}`)}
              />
            )}
          </div>
        )}

        {/* Single Dish Route: /dishes/:dishId */}
        {isSingleDish && (
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="nav-back-btn"
                onClick={() => navigateTo('/dishes')}
              >
                ← Back to All Dishes
              </button>
              <span className="stat-chip">Dish #{singleDishId}</span>
            </div>

            {singleDishLoading && !singleDish ? (
              <div className="card card--skeleton" style={{ minHeight: '380px' }}>
                <div className="skeleton skeleton--media" />
                <div className="card__content">
                  <div className="skeleton skeleton--title" />
                  <div className="skeleton skeleton--toggle" />
                </div>
              </div>
            ) : singleDishError ? (
              <ErrorBanner
                variant="fullpage"
                title="Dish Not Found"
                message={singleDishError}
                actionText="Back to Dishes"
                onAction={() => navigateTo('/dishes')}
              />
            ) : singleDish ? (
              <DishCard
                dish={singleDish}
                newerServerDish={newerServerDishesMap[singleDish.dishId]}
                onSaveSuccess={(updated) => {
                  setSingleDish(updated);
                  handleSaveSuccess(updated);
                }}
                onReloadDish={(reloaded) => {
                  setSingleDish(reloaded);
                  handleReloadDish(reloaded);
                }}
              />
            ) : null}
          </div>
        )}

        {/* Unknown Routes */}
        {isUnknownRoute && (
          <ErrorBanner
            variant="fullpage"
            title="404 - Page Not Found"
            message={`The requested route "${currentPath}" does not exist.`}
            actionText="Go to Dishes"
            onAction={() => navigateTo('/dishes')}
          />
        )}
      </main>
    </div>
  );
}

export default App;
