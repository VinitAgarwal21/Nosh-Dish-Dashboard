import React from 'react';
import DishCard from './DishCard';

/**
 * DishGrid component
 * Manages responsive layout grid, empty state, and loading skeleton cards.
 */
export function DishGrid({
  dishes,
  newerServerDishesMap = {},
  isLoading,
  onSaveSuccess,
  onReloadDish,
}) {
  if (isLoading) {
    return (
      <div className="dish-grid" aria-label="Loading dishes">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="card card--skeleton" aria-hidden="true">
            <div className="skeleton skeleton--media" />
            <div className="card__content">
              <div className="skeleton skeleton--title" />
              <div className="skeleton skeleton--toggle" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!dishes || dishes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🍽️</div>
        <h3 className="empty-state__title">No Dishes Found</h3>
        <p className="empty-state__description">
          The database has no dishes registered yet. Run <code>npm run seed</code> in the terminal to load dishes.
        </p>
      </div>
    );
  }

  return (
    <div className="dish-grid" role="region" aria-label="Dishes collection">
      {dishes.map((dish) => (
        <DishCard
          key={dish.dishId}
          dish={dish}
          newerServerDish={newerServerDishesMap[dish.dishId]}
          onSaveSuccess={onSaveSuccess}
          onReloadDish={onReloadDish}
        />
      ))}
    </div>
  );
}

export default DishGrid;
