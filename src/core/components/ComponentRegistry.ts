import type { Player } from "@minecraft/server";
import { readJson, writeJson } from "../persistence/DynamicPropertyCodec";
import type { ComponentContainer, ComponentKey, Serializable } from "./ComponentContainer";

/** One self-registered per-player component: how to load it, and where it lives. */
export interface PlayerComponentDefinition<T extends Serializable<S>, S> {
  readonly key: ComponentKey<T>;
  /** Dynamic property this component's snapshot round-trips through (see DynamicPropertyCodec). */
  readonly dynamicPropertyKey: string;
  /** Used the very first time a player is ever seen - nothing stored yet. */
  readonly defaultSnapshot: S;
  readonly deserialize: (snapshot: S) => T;
}

// Stored type-erased the same way ComponentContainer itself does (a Map of
// unknown values behind typed keys) - registerPlayerComponent() below is
// what keeps each call site fully type-checked.
const definitions: PlayerComponentDefinition<Serializable<unknown>, unknown>[] = [];

/**
 * One-line self-registration for a per-player component: call this at the
 * bottom of the component's own file (see CurrencyComponent.ts) and
 * PlayerSystem hydrates/persists it for every player automatically - the
 * System that actually uses the component never reads/deserializes it by hand.
 */
export function registerPlayerComponent<T extends Serializable<S>, S>(definition: PlayerComponentDefinition<T, S>): void {
  definitions.push(definition as PlayerComponentDefinition<Serializable<unknown>, unknown>);
}

/**
 * PlayerSystem-only: hydrates every self-registered component onto a
 * freshly-created player from its dynamic property, or from the
 * component's default the very first time this player is ever seen -
 * which also persists that default right away, same as currency always has.
 */
export function hydratePlayerComponents(player: Player, components: ComponentContainer): void {
  for (const definition of definitions) {
    const stored = readJson<unknown>(player, definition.dynamicPropertyKey, undefined);
    const component = definition.deserialize((stored === undefined ? definition.defaultSnapshot : stored) as never);
    components.set(definition.key, component);

    if (stored === undefined) {
      writeJson(player, definition.dynamicPropertyKey, component.serialize());
    }
  }
}
