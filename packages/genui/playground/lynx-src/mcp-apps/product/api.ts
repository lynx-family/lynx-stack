// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { AppApiDefinition } from '@lynx-js/genui/mcp-apps';

export const PRODUCT_API_NAME = 'product.get_details';
export const PRODUCT_RENDERER_ID = 'product';

export type ProductAvailability =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock';

export interface ProductData {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  currency: string;
  availability: ProductAvailability;
  originalPrice?: number;
  badge?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ProductPurchaseResult {
  status: 'confirmed';
  message: string;
  orderId?: string;
}

export interface ProductApiResult {
  summary: string;
  product: ProductData;
  purchase?: ProductPurchaseResult;
}

export type ProductPurchaseApiResult = ProductApiResult & {
  purchase: ProductPurchaseResult;
};

export const PRODUCT_API: AppApiDefinition = {
  name: PRODUCT_API_NAME,
  title: 'Product details',
  description:
    'Find a product by ID or short name and return details for a visual product card. Use this when the user asks to see a product such as a sneaker.',
  inputSchema: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description:
          'Product identifier or short product name, for example sneaker.',
      },
    },
    required: ['productId'],
    additionalProperties: false,
  },
  renderer: PRODUCT_RENDERER_ID,
};

const SNEAKER_IMAGE_URL =
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85';

function textValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function integerValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value)
    : fallback;
}

function orderSeed(value: string): number {
  let seed = 0;
  for (const character of value) {
    seed = (seed * 31 + (character.codePointAt(0) ?? 0)) % 100_000;
  }
  return seed;
}

export function getProductData(
  args: Record<string, unknown>,
): ProductData {
  const id = textValue(args.productId, 'limited-edition-sneaker');
  return {
    id,
    name: 'Velocity Runner \'Solar Red\'',
    description:
      'A lightweight everyday sneaker with breathable mesh, responsive cushioning, and a high-grip rubber outsole.',
    imageUrl: SNEAKER_IMAGE_URL,
    price: 129,
    originalPrice: 159,
    currency: 'USD',
    availability: 'low_stock',
    badge: 'LIMITED EDITION',
    category: 'SNEAKERS',
    rating: 4.8,
    reviewCount: 326,
  };
}

export function callProductApi(
  args: Record<string, unknown>,
): ProductApiResult {
  const product = getProductData(args);
  const refresh = Math.max(0, integerValue(args.refresh, 0));
  return {
    summary: refresh > 0
      ? `${product.name} refreshed ${refresh}× at $${product.price.toFixed(2)}.`
      : `${product.name} is available for $${product.price.toFixed(2)}.`,
    product,
  };
}

export function callProductPurchaseApi(
  args: Record<string, unknown>,
): ProductPurchaseApiResult {
  const product = getProductData(args);
  const quantity = Math.max(1, integerValue(args.quantity, 1));
  const orderId = `LYNX-${String(orderSeed(product.id)).padStart(5, '0')}`;
  return {
    summary: `Order ${orderId} confirmed for ${quantity} × ${product.name}.`,
    product,
    purchase: {
      status: 'confirmed',
      orderId,
      message: `${quantity} pair${
        quantity === 1 ? '' : 's'
      } reserved. Order ${orderId}.`,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || nonEmptyText(value) !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value);
}

function isAvailability(value: unknown): value is ProductAvailability {
  return value === 'in_stock'
    || value === 'low_stock'
    || value === 'out_of_stock';
}

function parsePurchaseResult(value: unknown): ProductPurchaseResult | null {
  if (!isRecord(value) || value.status !== 'confirmed') return null;
  const message = nonEmptyText(value.message);
  if (!message || !isOptionalText(value.orderId)) return null;
  const orderId = nonEmptyText(value.orderId);
  return {
    status: 'confirmed',
    message,
    ...(orderId ? { orderId } : {}),
  };
}

export function parseProductApiResult(value: unknown): ProductApiResult | null {
  if (!isRecord(value) || !isRecord(value.product)) return null;

  const summary = nonEmptyText(value.summary);
  const productValue = value.product;
  const id = nonEmptyText(productValue.id);
  const name = nonEmptyText(productValue.name);
  const description = nonEmptyText(productValue.description);
  const imageUrl = nonEmptyText(productValue.imageUrl);
  const currency = nonEmptyText(productValue.currency);
  if (
    !summary
    || !id
    || !name
    || !description
    || !imageUrl
    || !currency
    || !isFiniteNumber(productValue.price)
    || productValue.price < 0
    || !isOptionalFiniteNumber(productValue.originalPrice)
    || (
      isFiniteNumber(productValue.originalPrice)
      && productValue.originalPrice < 0
    )
    || !isOptionalFiniteNumber(productValue.rating)
    || (
      isFiniteNumber(productValue.rating)
      && (productValue.rating < 0 || productValue.rating > 5)
    )
    || !isOptionalFiniteNumber(productValue.reviewCount)
    || (
      isFiniteNumber(productValue.reviewCount)
      && (
        productValue.reviewCount < 0
        || !Number.isInteger(productValue.reviewCount)
      )
    )
    || !isOptionalText(productValue.badge)
    || !isOptionalText(productValue.category)
    || (
      productValue.availability !== undefined
      && !isAvailability(productValue.availability)
    )
  ) {
    return null;
  }

  const originalPrice = isFiniteNumber(productValue.originalPrice)
    ? productValue.originalPrice
    : undefined;
  const badge = nonEmptyText(productValue.badge);
  const category = nonEmptyText(productValue.category);
  const rating = isFiniteNumber(productValue.rating)
    ? productValue.rating
    : undefined;
  const reviewCount = isFiniteNumber(productValue.reviewCount)
    ? productValue.reviewCount
    : undefined;
  const purchase = value.purchase === undefined
    ? undefined
    : parsePurchaseResult(value.purchase);
  if (value.purchase !== undefined && !purchase) return null;

  const product: ProductData = {
    id,
    name,
    description,
    imageUrl,
    price: productValue.price,
    currency: currency.toUpperCase(),
    availability: isAvailability(productValue.availability)
      ? productValue.availability
      : 'in_stock',
  };
  if (originalPrice !== undefined) product.originalPrice = originalPrice;
  if (badge) product.badge = badge;
  if (category) product.category = category;
  if (rating !== undefined) product.rating = rating;
  if (reviewCount !== undefined) product.reviewCount = reviewCount;

  return {
    summary,
    product,
    ...(purchase ? { purchase } : {}),
  };
}
