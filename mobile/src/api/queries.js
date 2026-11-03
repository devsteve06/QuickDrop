import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

const loadingState = () => ({ status: "loading", data: null, error: null });

export function useRestaurants() {
  const [state, setState] = useState(loadingState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    api
      .listRestaurants()
      .then((data) => {
        if (active) setState({ status: "success", data, error: null });
      })
      .catch((error) => {
        if (active) setState({ status: "error", data: null, error });
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState(loadingState());
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}

export function useRestaurant(id) {
  const requestId = id ? String(id) : null;
  const [state, setState] = useState(() => ({ ...loadingState(), requestId: null }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requestId) return undefined;
    let active = true;

    api
      .getRestaurant(requestId)
      .then((data) => {
        if (active) setState({ status: "success", data, error: null, requestId });
      })
      .catch((error) => {
        if (active) setState({ status: "error", data: null, error, requestId });
      });

    return () => {
      active = false;
    };
  }, [requestId, attempt]);

  const retry = useCallback(() => {
    setState({ ...loadingState(), requestId: null });
    setAttempt((value) => value + 1);
  }, []);

  if (!requestId) {
    return {
      status: "error",
      data: null,
      error: new Error("No restaurant was selected."),
      retry,
    };
  }

  // Params changed (or a retry was requested) and the matching response has not landed yet.
  if (state.requestId !== requestId) {
    return { ...loadingState(), retry };
  }

  return { ...state, retry };
}

export function useOrder(id) {
  const requestId = id ? String(id) : null;
  const [state, setState] = useState(() => ({ ...loadingState(), requestId: null }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requestId) return undefined;
    let active = true;

    api
      .getOrder(requestId)
      .then((data) => {
        if (active) setState({ status: "success", data, error: null, requestId });
      })
      .catch((error) => {
        if (active) setState({ status: "error", data: null, error, requestId });
      });

    return () => {
      active = false;
    };
  }, [requestId, attempt]);

  const retry = useCallback(() => {
    setState({ ...loadingState(), requestId: null });
    setAttempt((value) => value + 1);
  }, []);

  if (!requestId) {
    return {
      status: "error",
      data: null,
      error: new Error("No order was selected."),
      retry,
    };
  }

  if (state.requestId !== requestId) {
    return { ...loadingState(), retry };
  }

  return { ...state, retry };
}
