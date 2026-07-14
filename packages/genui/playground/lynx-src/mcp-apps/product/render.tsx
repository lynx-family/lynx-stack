// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineAppRenderer } from '@lynx-js/genui/mcp-apps/render';
import type { AppRendererProps } from '@lynx-js/genui/mcp-apps/render';
import { useEffect, useState } from '@lynx-js/react';

import {
  PRODUCT_RENDERER_ID,
  callProductApi,
  callProductPurchaseApi,
  parseProductApiResult,
} from './api.js';
import type { ProductApiResult, ProductData } from './api.js';
import './render.css';

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  USD: '$',
};

function formatPrice(value: number, currency: string): string {
  const prefix = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${prefix}${value.toFixed(2)}`;
}

function availabilityLabel(product: ProductData): string {
  if (product.availability === 'out_of_stock') return 'Out of stock';
  if (product.availability === 'low_stock') return 'Low stock';
  return 'In stock';
}

function availabilityClassName(product: ProductData): string {
  if (product.availability === 'out_of_stock') {
    return 'productAvailability productAvailabilityUnavailable';
  }
  if (product.availability === 'low_stock') {
    return 'productAvailability productAvailabilityLow';
  }
  return 'productAvailability';
}

function nextRefresh(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value) + 1)
    : 1;
}

function refreshButtonLabel(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return 'Refresh';
  }
  return `Refreshed ${Math.floor(value)}×`;
}

function purchaseButtonLabel(
  product: ProductData,
  purchased: boolean,
): string {
  if (purchased) return 'Purchased';
  if (product.availability === 'out_of_stock') return 'Out of stock';
  return 'Buy now';
}

export function ProductCard(props: AppRendererProps<ProductApiResult>) {
  const [input, setInput] = useState(props.input);
  const [result, setResult] = useState(props.result);

  useEffect(() => {
    setInput(props.input);
    setResult(props.result);
  }, [props.input, props.result]);

  const product = result.product;
  const purchased = result.purchase?.status === 'confirmed';
  const canPurchase = product.availability !== 'out_of_stock' && !purchased;
  const rating = product.rating === undefined
    ? ''
    : `★ ${product.rating.toFixed(1)}`;
  const reviews = product.reviewCount === undefined
    ? ''
    : `${product.reviewCount} review${product.reviewCount === 1 ? '' : 's'}`;
  const ratingSummary = rating && reviews ? `${rating} · ${reviews}` : rating
    || reviews;
  const buyButtonClassName = canPurchase
    ? 'productBuyButton'
    : 'productBuyButton productBuyButtonDisabled';
  const buyTextClassName = canPurchase
    ? 'productBuyButtonText'
    : 'productBuyButtonText productBuyButtonTextDisabled';
  const buyLabel = purchaseButtonLabel(product, purchased);

  const refresh = () => {
    const nextInput = {
      productId: product.id,
      refresh: nextRefresh(input.refresh),
    };
    setInput(nextInput);
    setResult(callProductApi(nextInput));
  };
  const purchase = () => {
    if (!canPurchase) return;
    setResult(callProductPurchaseApi({ productId: product.id, quantity: 1 }));
  };

  return (
    <view className='productCard'>
      <view className='productMedia'>
        <image
          className='productImage'
          src={product.imageUrl}
          mode='aspectFill'
        />
        {product.badge
          ? (
            <view className='productBadge'>
              <text className='productBadgeText'>{product.badge}</text>
            </view>
          )
          : null}
      </view>

      <view className='productContent'>
        <view className='productMetaRow'>
          <text className='productCategory'>
            {product.category ?? 'FEATURED PRODUCT'}
          </text>
          <text className={availabilityClassName(product)}>
            {availabilityLabel(product)}
          </text>
        </view>

        <text className='productName' text-maxline={2}>{product.name}</text>
        <text className='productDescription' text-maxline={2}>
          {product.description}
        </text>

        {ratingSummary
          ? <text className='productRating'>{ratingSummary}</text>
          : null}

        <view className='productPriceRow'>
          <text className='productPrice'>
            {formatPrice(product.price, product.currency)}
          </text>
          {product.originalPrice !== undefined
              && product.originalPrice > product.price
            ? (
              <text className='productOriginalPrice'>
                {formatPrice(product.originalPrice, product.currency)}
              </text>
            )
            : null}
        </view>

        {result.purchase
          ? (
            <view className='productPurchaseResult'>
              <text className='productPurchaseIcon'>✓</text>
              <view className='productPurchaseCopy'>
                <text className='productPurchaseTitle'>Order confirmed</text>
                <text className='productPurchaseMessage' text-maxline={2}>
                  {result.purchase.message}
                </text>
              </view>
            </view>
          )
          : null}

        <view className='productActions'>
          <view className='productRefreshButton' bindtap={refresh}>
            <text className='productRefreshIcon'>↻</text>
            <text className='productRefreshText'>
              {refreshButtonLabel(input.refresh)}
            </text>
          </view>
          <view className={buyButtonClassName} bindtap={purchase}>
            <text className={buyTextClassName}>{buyLabel}</text>
          </view>
        </view>
      </view>
    </view>
  );
}

export const PRODUCT_RENDERER = defineAppRenderer({
  id: PRODUCT_RENDERER_ID,
  parseResult: parseProductApiResult,
  component: ProductCard,
  invalidResultMessage: 'Product API returned an invalid result.',
});
