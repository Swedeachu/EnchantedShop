/**
 * Side-effect-only barrel, same reason as src/systems/index.ts: importing
 * this once (see SystemManager.ts) is what makes esbuild bundle every
 * scene file below, so each one's self-registration (see SceneRegistry.ts)
 * actually runs. Add one line here whenever a new scene file is created.
 */
import "./LoadingScene";
import "./HubScene";
