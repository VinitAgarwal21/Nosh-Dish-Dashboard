import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for lightweight client-side routing using the HTML5 History API (pushState).
 * Handles route parsing for /, /dishes, /dishes/:dishId, and 404 routes.
 */
export function useRouter() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((path) => {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  }, []);

  const normalizedPath = (currentPath || '/').replace(/\/+$/, '') || '/';
  const isHome = normalizedPath === '/';
  const isDishes = normalizedPath === '/dishes';

  // Support /dishes/:dishId route
  const singleDishMatch = normalizedPath.match(/^\/dishes\/([^/]+)$/);
  const isSingleDish = Boolean(singleDishMatch);
  const singleDishId = singleDishMatch ? decodeURIComponent(singleDishMatch[1]) : null;

  const isUnknownRoute = !isHome && !isDishes && !isSingleDish;

  return {
    currentPath,
    navigateTo,
    isHome,
    isDishes,
    isSingleDish,
    singleDishId,
    isUnknownRoute,
  };
}

export default useRouter;
