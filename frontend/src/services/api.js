/**
 * API Client for Nosh Dish Dashboard
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '');

/**
 * Custom API Error class containing status and payload details
 */
export class ApiError extends Error {
  constructor(message, status, details = null, currentDish = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.currentDish = currentDish;
  }
}

/**
 * Fetches all dishes from the backend
 * @returns {Promise<Array>}
 */
export async function getDishes() {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/dishes`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
  } catch (netErr) {
    throw new ApiError(
      `Unable to reach backend server: ${netErr.message || 'Network error'}`,
      0
    );
  }

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      // Non-JSON response
    }
    throw new ApiError(
      errorData.message || errorData.error || `HTTP error ${response.status}`,
      response.status,
      errorData.details || null,
      errorData.currentDish || null
    );
  }

  return response.json();
}

/**
 * Updates a dish with optimistic locking
 * @param {string} dishId
 * @param {Object} payload
 * @param {string} payload.dishName
 * @param {boolean} payload.isPublished
 * @param {number} payload.expectedVersion
 * @returns {Promise<Object>}
 */
export async function updateDish(dishId, { dishName, isPublished, expectedVersion }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/dishes/${encodeURIComponent(dishId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ dishName, isPublished, expectedVersion }),
    });
  } catch (netErr) {
    throw new ApiError(
      `Network connection failed: ${netErr.message || 'Server unreachable'}`,
      0
    );
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
  }

  if (response.status === 200) {
    return data;
  }

  if (response.status === 409) {
    throw new ApiError(
      data.message || 'Conflict: Dish was modified by another update.',
      409,
      data.details || null,
      data.currentDish || null
    );
  }

  if (response.status === 400) {
    throw new ApiError(
      data.message || data.error || 'Validation error',
      400,
      data.details || [],
      null
    );
  }

  if (response.status === 404) {
    throw new ApiError(
      data.message || 'Dish not found.',
      404,
      null,
      null
    );
  }

  throw new ApiError(
    data.message || data.error || `Unexpected server error (${response.status})`,
    response.status,
    null,
    null
  );
}
