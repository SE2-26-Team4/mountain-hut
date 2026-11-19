import { useEffect, useState } from "react";
import CapacityAPI from "../API/capacity-api.js";

/** @typedef {Awaited<ReturnType<typeof CapacityAPI.getScheduleCopyPreview>>} Preview */

/**
 * @param {string} from
 * @param {string} to
 */
export default function useScheduleCopyPreview(from, to) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(
    /** @type {{ key: string, data: Preview | null, error: string } | null} */
    (null),
  );

  const key = `${from}/${to}/${revision}`;

  useEffect(() => {
    if (!from || !to) return;

    const controller = new AbortController();

    async function load() {
      try {
        const data = await CapacityAPI.getScheduleCopyPreview(
          from,
          to,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setResult({ key, data, error: "" });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({
            key,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Could not load the preview.",
          });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [from, to, key]);

  const current = result?.key === key ? result : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? "",
    loading: Boolean(from && to && !current),
    refresh: () => setRevision((value) => value + 1),
  };
}
