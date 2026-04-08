/**
 * Local wrapper for useActor from @caffeineai/core-infrastructure.
 * Binds the local createActor function so consumers don't need to pass it manually.
 */
import { createActor } from "@/backend";
import type { backendInterface } from "@/backend.d";
import { useActor as _useActor } from "@caffeineai/core-infrastructure";

export function useActor() {
  return _useActor<backendInterface>(
    createActor as Parameters<typeof _useActor<backendInterface>>[0],
  );
}
