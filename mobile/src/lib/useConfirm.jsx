import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

/**
 * Promise-based confirmation dialog that works on native and web without
 * `window.confirm`. Usage:
 *
 *   const [dialog, confirm] = useConfirm();
 *   const ok = await confirm({ title: "Clear cart?", message: "..." });
 */
export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((nextOptions = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions(nextOptions);
    });
  }, []);

  const settle = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    if (resolve) resolve(result);
  }, []);

  const dialog = (
    <ConfirmDialog
      visible={options !== null}
      title={options?.title ?? "Are you sure?"}
      message={options?.message ?? ""}
      confirmLabel={options?.confirmLabel ?? "Confirm"}
      cancelLabel={options?.cancelLabel ?? "Cancel"}
      destructive={options?.destructive ?? false}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return [dialog, confirm];
}
