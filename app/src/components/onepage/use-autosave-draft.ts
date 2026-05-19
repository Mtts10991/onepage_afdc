"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnePageData } from "@/lib/onepage-schema";

/**
 * Autosave + localStorage draft hook for the OnePage editor.
 *
 * Mechanics:
 *  - Debounces server writes to AUTOSAVE_DELAY_MS after the last
 *    change, so a typing burst makes one network call, not dozens.
 *  - Mirrors the in-flight edit into localStorage on every change (no
 *    debounce) so a power loss / tab close right before the next debounce
 *    fire still leaves a recoverable snapshot.
 *  - Detects optimistic-concurrency conflicts (409 from the PUT route)
 *    and surfaces them via `status === "conflict"`. The editor decides
 *    what to do (we recommend offering "reload" + showing a banner).
 *  - On unmount it flushes any pending change synchronously via
 *    `navigator.sendBeacon` fallback to `fetch({keepalive:true})`, so a
 *    user navigating away mid-debounce doesn't lose the last few seconds.
 */

const AUTOSAVE_DELAY_MS = 2500;
const DRAFT_KEY = (id: string) => `onepage:draft:${id}`;

export type AutosaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "conflict"
  | "error";

export interface DraftSnapshot {
  data: OnePageData;
  title: string;
  /** updatedAt that was current on the server when this draft was created. */
  baseUpdatedAt: string;
  /** Wall-clock time of the last local change (ms). */
  dirtyAt: number;
}

export function readLocalDraft(id: string): DraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY(id));
    if (!raw) return null;
    return JSON.parse(raw) as DraftSnapshot;
  } catch {
    return null;
  }
}

export function clearLocalDraft(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_KEY(id));
}

interface UseAutosaveDraftArgs {
  /** Onepage id. Required — autosave is a no-op in create mode. */
  id: string | undefined;
  data: OnePageData;
  title: string;
  /** Server's `updatedAt` at fetch time (drives optimistic concurrency). */
  initialServerUpdatedAt: string;
  /** Disable autosave entirely (e.g. while a recovery dialog is open). */
  enabled?: boolean;
}

interface UseAutosaveDraftReturn {
  status: AutosaveStatus;
  /** Most recent `updatedAt` echoed back by the server. Use this when
   * the editor needs to make a follow-up call (e.g. explicit save). */
  serverUpdatedAt: string;
  /** Flush any pending change immediately. Returns the PUT promise. */
  flush: () => Promise<void>;
}

export function useAutosaveDraft(
  args: UseAutosaveDraftArgs,
): UseAutosaveDraftReturn {
  const { id, data, title, initialServerUpdatedAt, enabled = true } = args;
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [serverUpdatedAt, setServerUpdatedAt] = useState(initialServerUpdatedAt);

  // Track the latest values via refs so the debounce closure always
  // reads fresh snapshots without re-binding the timer.
  const dataRef = useRef(data);
  const titleRef = useRef(title);
  const serverUpdatedAtRef = useRef(initialServerUpdatedAt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    dataRef.current = data;
    titleRef.current = title;
  }, [data, title]);

  useEffect(() => {
    serverUpdatedAtRef.current = serverUpdatedAt;
  }, [serverUpdatedAt]);

  const performSave = useCallback(async (): Promise<void> => {
    if (!id) return;
    // Coalesce overlapping autosaves: if one is already in flight we
    // simply chain off it so the next change still gets persisted.
    if (inflightRef.current) {
      await inflightRef.current;
    }
    const p = (async () => {
      setStatus("saving");
      try {
        const res = await fetch(`/api/onepages/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleRef.current,
            data: dataRef.current,
            isAutosave: true,
            expectedUpdatedAt: serverUpdatedAtRef.current,
          }),
          keepalive: true,
        });
        if (res.status === 409) {
          setStatus("conflict");
          // Don't clear the local draft — the editor will use it for
          // the recovery banner.
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const updated = (await res.json()) as { updatedAt?: string };
        if (updated.updatedAt) {
          setServerUpdatedAt(updated.updatedAt);
        }
        setStatus("saved");
        // Successful save → the local mirror is no longer "unsaved
        // work", so drop it. A new change will recreate it instantly.
        clearLocalDraft(id);
      } catch {
        setStatus("error");
      }
    })();
    inflightRef.current = p;
    try {
      await p;
    } finally {
      if (inflightRef.current === p) inflightRef.current = null;
    }
  }, [id]);

  // Debounce on every (data, title) change. Also mirror into localStorage
  // so an unexpected close doesn't lose anything written since the last
  // network save.
  useEffect(() => {
    if (!id || !enabled) return;
    // Skip the very first render — we don't want to "save" the initial
    // state echoed back from the server.
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setStatus("dirty");
    try {
      const snapshot: DraftSnapshot = {
        data,
        title,
        baseUpdatedAt: serverUpdatedAtRef.current,
        dirtyAt: Date.now(),
      };
      window.localStorage.setItem(DRAFT_KEY(id), JSON.stringify(snapshot));
    } catch {
      // Quota exceeded or private mode — autosave still proceeds via
      // the server path; we only lose the recovery safety net.
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void performSave();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, title, id, enabled, performSave]);

  // On unmount, fire one last save if a debounce is still pending.
  useEffect(() => {
    return () => {
      if (timerRef.current && id) {
        clearTimeout(timerRef.current);
        // Best-effort: keepalive lets the request outlive the page.
        try {
          void fetch(`/api/onepages/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: titleRef.current,
              data: dataRef.current,
              isAutosave: true,
              expectedUpdatedAt: serverUpdatedAtRef.current,
            }),
            keepalive: true,
          });
        } catch {
          // ignore
        }
      }
    };
  }, [id]);

  return { status, serverUpdatedAt, flush: performSave };
}
