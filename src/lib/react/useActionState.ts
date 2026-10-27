"use client";

import { useCallback, useState, useTransition } from "react";

/**
 * A minimal useActionState compatible with React 18.
 *
 * React 19 ships this hook; this project is pinned to React 18, so submitting a
 * form to a Server Action with pending and error state needs a local equivalent.
 * It has the same shape, so moving to React 19 later means deleting this file
 * and changing the import.
 */
export function useActionState<State, Payload>(
  action: (state: State, payload: Payload) => Promise<State>,
  initialState: State,
): [State, (payload: Payload) => void, boolean] {
  const [state, setState] = useState<State>(initialState);
  const [pending, startTransition] = useTransition();

  const formAction = useCallback(
    (payload: Payload) => {
      startTransition(async () => {
        const next = await action(state, payload);
        setState(next);
      });
    },
    [action, state],
  );

  return [state, formAction, pending];
}
