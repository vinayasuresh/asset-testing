import { useState, useEffect } from "react";

/**
 * Custom hook to track URL search parameters that change independently of pathname.
 * Unlike wouter's useLocation which only tracks pathname changes, this hook
 * properly detects when query string parameters change (e.g., /assets?type=Hardware).
 */
export function useSearch(): string {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    // Update search when navigation occurs
    const handleLocationChange = () => {
      setSearch(window.location.search);
    };

    // Listen for popstate (back/forward browser navigation)
    window.addEventListener('popstate', handleLocationChange);

    // Listen for custom locationchange event (pushState/replaceState)
    window.addEventListener('locationchange', handleLocationChange as EventListener);

    // Override pushState and replaceState to emit custom event
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange as EventListener);
      
      // Restore original methods
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  return search;
}