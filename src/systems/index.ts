/**
 * Side-effect-only barrel: every system self-registers when its file is
 * evaluated (see SystemRegistry.ts), but esbuild only bundles a file
 * something actually imports. Importing this once (see SystemManager.ts)
 * guarantees every gameplay system here is included even if nothing else
 * references it directly (e.g. it has no typed getter). Add one line here
 * whenever a new file is added to this folder.
 */
import "./PlayerSystem";
import "./CurrencySystem";
import "./KitsSystem";
import "./DeliverySystem";
import "./ShopSystem";
