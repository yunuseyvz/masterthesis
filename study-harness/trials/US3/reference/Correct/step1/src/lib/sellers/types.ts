/** Capabilities a seller may have switched on or off. */
export interface SellerFeatures {
  checkout: boolean;
  refunds: boolean;
  analytics: boolean;
}

/** Numeric ceilings that apply to a seller's usage. */
export interface SellerLimits {
  maxUsers: number;
  maxProducts: number;
  monthlyOrders: number;
}

/** A seller's complete, effective configuration. */
export interface SellerConfig {
  features: SellerFeatures;
  limits: SellerLimits;
}

/** The fields a seller may customize; anything omitted falls back to the shop defaults. */
export interface SellerOverrides {
  features?: Partial<SellerFeatures>;
  limits?: { [K in keyof SellerLimits]?: number | null };
}

export interface Seller {
  id: string;
  name: string;
  overrides: SellerOverrides;
}

export type FeatureName = keyof SellerFeatures;
export type LimitName = keyof SellerLimits;

/** The baseline every seller inherits until it overrides a field. */
export const SHOP_DEFAULTS: SellerConfig = {
  features: {
    checkout: true,
    refunds: true,
    analytics: false,
  },
  limits: {
    maxUsers: 5,
    maxProducts: 100,
    monthlyOrders: 1000,
  },
};
