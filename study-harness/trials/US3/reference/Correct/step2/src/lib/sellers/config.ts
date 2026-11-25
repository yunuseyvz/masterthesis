import {
  SHOP_DEFAULTS,
  type FeatureName,
  type LimitName,
  type Seller,
  type SellerConfig,
} from "./types.ts";

/**
 * A seller's effective configuration: the shop defaults with the seller's own overrides applied, field by
 * field. A limit set to null counts as not set, so the default applies.
 */
export function resolveSellerConfig(
  seller: Seller,
  defaults: SellerConfig = SHOP_DEFAULTS,
): SellerConfig {
  const limits = { ...defaults.limits };
  for (const name of Object.keys(limits) as LimitName[]) {
    const override = seller.overrides.limits?.[name];
    if (override !== undefined && override !== null) limits[name] = override;
  }
  return {
    features: { ...defaults.features, ...seller.overrides.features },
    limits,
  };
}

/** Whether a seller has a feature switched on by default or through its own override. */
export function isFeatureEnabled(
  seller: Seller,
  feature: FeatureName,
  defaults: SellerConfig = SHOP_DEFAULTS,
): boolean {
  return resolveSellerConfig(seller, defaults).features[feature];
}

/** A seller's effective value for one limit, after overrides. */
export function limitFor(
  seller: Seller,
  name: LimitName,
  defaults: SellerConfig = SHOP_DEFAULTS,
): number {
  return resolveSellerConfig(seller, defaults).limits[name];
}
