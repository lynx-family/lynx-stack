// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

interface A2UIComponent {
  id: string;
  component: string;
  [key: string]: unknown;
}

type A2UIMessage =
  | {
    version: 'v0.9';
    createSurface: {
      surfaceId: string;
      catalogId: string;
    };
  }
  | {
    version: 'v0.9';
    updateComponents: {
      surfaceId: string;
      components: A2UIComponent[];
    };
  };

export interface ZTemplateDemo {
  id: string;
  title: string;
  description: string;
  hasStaticJson?: boolean;
  messages: A2UIMessage[];
}

const CATALOG_ID = 'https://a2ui.org/specification/v0_9/basic_catalog.json';

const productImage =
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=720&q=80';
const mediaImage =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=720&q=80';

function text(
  id: string,
  value: string,
  variant: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body' = 'body',
  emphasis?: 'medium' | 'strong',
): A2UIComponent {
  return {
    id,
    component: 'Text',
    text: value,
    variant,
    ...(emphasis ? { emphasis } : {}),
  };
}

function icon(
  id: string,
  name: string,
  color: 'primary' | 'muted' | 'inherit' = 'muted',
): A2UIComponent {
  return {
    id,
    component: 'Icon',
    name,
    color,
    size: 'md',
  };
}

function image(
  id: string,
  url: string,
  variant:
    | 'icon'
    | 'avatar'
    | 'smallFeature'
    | 'mediumFeature'
    | 'largeFeature'
    | 'header' = 'mediumFeature',
): A2UIComponent {
  return {
    id,
    component: 'Image',
    url,
    fit: 'cover',
    variant,
  };
}

function row(
  id: string,
  children: string[],
  options: Partial<Pick<A2UIComponent, 'align' | 'justify'>> = {},
): A2UIComponent {
  return {
    id,
    component: 'Row',
    children,
    align: options.align ?? 'center',
    justify: options.justify ?? 'start',
  };
}

function column(
  id: string,
  children: string[],
  align: 'start' | 'center' | 'end' | 'stretch' = 'stretch',
): A2UIComponent {
  return {
    id,
    component: 'Column',
    children,
    align,
  };
}

function card(
  id: string,
  child: string,
  variant: 'elevated' | 'outlined' | 'filled' | 'ghost' = 'elevated',
): A2UIComponent {
  return {
    id,
    component: 'Card',
    child,
    variant,
  };
}

function button(
  id: string,
  label: string,
  variant: 'primary' | 'borderless' = 'primary',
): A2UIComponent[] {
  return [
    text(`${id}-text`, label, 'body', 'medium'),
    action(id, `${id}-text`, variant),
  ];
}

function action(
  id: string,
  child: string,
  variant: 'primary' | 'borderless' = 'borderless',
): A2UIComponent {
  return {
    id,
    component: 'Button',
    child,
    variant,
    action: {
      event: {
        name: `${id}.tap`,
        context: {
          templatePackage: 'z',
          templateVersion: '0.0.35',
        },
      },
    },
  };
}

function titleBar(prefix: string, moreText = '更多'): A2UIComponent[] {
  return [
    row(`${prefix}-titlebar`, [
      `${prefix}-app`,
      `${prefix}-more-action`,
    ], { justify: 'spaceBetween' }),
    row(`${prefix}-app`, [
      `${prefix}-app-mark`,
      `${prefix}-app-name`,
    ]),
    icon(`${prefix}-app-mark`, 'home', 'primary'),
    text(`${prefix}-app-name`, 'z 应用', 'caption', 'medium'),
    row(`${prefix}-more`, [
      `${prefix}-more-text`,
      `${prefix}-more-icon`,
    ]),
    text(`${prefix}-more-text`, moreText, 'caption'),
    icon(`${prefix}-more-icon`, 'more_vert', 'muted'),
    action(`${prefix}-more-action`, `${prefix}-more`),
  ];
}

function infoRow(
  prefix: string,
  label: string,
  value: string,
  extra?: string,
): A2UIComponent[] {
  const valueChildren = extra
    ? [`${prefix}-value`, `${prefix}-extra`]
    : [`${prefix}-value`];
  return [
    row(prefix, [
      `${prefix}-label`,
      `${prefix}-values`,
    ], { justify: 'spaceBetween', align: 'start' }),
    text(`${prefix}-label`, label, 'caption'),
    column(`${prefix}-values`, valueChildren, 'end'),
    text(`${prefix}-value`, value, 'body', 'medium'),
    ...(extra ? [text(`${prefix}-extra`, extra, 'caption')] : []),
  ];
}

function feeRow(prefix: string, label: string, value: string): A2UIComponent[] {
  return [
    row(prefix, [
      `${prefix}-label`,
      `${prefix}-value`,
    ], { justify: 'spaceBetween' }),
    text(`${prefix}-label`, label, 'caption'),
    text(`${prefix}-value`, value, 'body', 'medium'),
  ];
}

function demo(
  id: string,
  title: string,
  description: string,
  components: A2UIComponent[],
): ZTemplateDemo {
  const surfaceId = id;
  return {
    id,
    title,
    description,
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components,
        },
      },
    ],
  };
}

const listCard = demo(
  'z-list-card',
  'ListCard',
  '0.0.35 list card template: app title bar, repeatable items, per-item actions, and view-more entry.',
  [
    card('root', 'list-card-body'),
    column('list-card-body', [
      'list-titlebar',
      'list-items',
      'list-view-more',
    ]),
    ...titleBar('list'),
    column('list-items', [
      'list-item-1',
      'list-item-2',
      'list-item-3',
      'list-item-4',
    ]),
    ...[1, 2, 3, 4].flatMap((index) => {
      const prefix = `list-item-${index}`;
      const titles = [
        '智能跑鞋 Pro',
        '便携咖啡杯',
        '城市周末套票',
        '蓝牙降噪耳机',
      ];
      const prices = ['4199元', '299元', '168元', '699元'];
      const descs = ['轻量缓震', '保温 12 小时', '含双人下午茶', '通勤低延迟'];
      return [
        card(prefix, `${prefix}-body`, 'outlined'),
        row(`${prefix}-body`, [
          `${prefix}-media`,
          `${prefix}-copy`,
          `${prefix}-action`,
        ], { justify: 'spaceBetween', align: 'center' }),
        ...(index === 1
          ? [image(`${prefix}-media`, productImage, 'smallFeature')]
          : [icon(`${prefix}-media`, index === 3 ? 'location_on' : 'star')]),
        column(`${prefix}-copy`, [
          `${prefix}-title`,
          `${prefix}-meta`,
        ]),
        text(`${prefix}-title`, titles[index - 1] ?? '列表项', 'h4'),
        text(
          `${prefix}-meta`,
          `${prices[index - 1]} · ${descs[index - 1]}`,
          'caption',
        ),
        ...button(
          `${prefix}-action`,
          index === 1 ? '下单' : '查看',
          'borderless',
        ),
      ];
    }),
    ...button('list-view-more', '查看更多'),
  ],
);

const askHumanCard = demo(
  'z-ask-human-card',
  'AskHumanCard',
  '0.0.35 ask-human template: human confirmation options plus an optional skip entry.',
  [
    card('root', 'ask-body'),
    column('ask-body', [
      'ask-title',
      'ask-copy',
      'ask-options',
      'ask-skip',
    ]),
    text('ask-title', '请选择门店', 'h3'),
    text(
      'ask-copy',
      '为你找到 3 个附近候选项，确认后继续处理任务。',
      'caption',
    ),
    column('ask-options', [
      'ask-option-1-action',
      'ask-option-2-action',
      'ask-option-3-action',
    ]),
    ...[
      '中关村创业大街店 · 0.6km',
      '北京中关村在握旗舰店 · 1.8km',
      '中关村城委店 · 3.5km',
    ].flatMap((label, index) => {
      const id = `ask-option-${index + 1}`;
      return [
        action(`${id}-action`, `${id}-card`),
        card(`${id}-card`, `${id}-body`, 'outlined'),
        row(`${id}-body`, [
          `${id}-text`,
          `${id}-icon`,
        ], { justify: 'spaceBetween' }),
        text(`${id}-text`, label, 'body', 'medium'),
        icon(`${id}-icon`, 'arrow_forward', 'primary'),
      ];
    }),
    ...button('ask-skip', '跳过', 'borderless'),
  ],
);

const singleItemCard = demo(
  'z-single-item-card',
  'SingleItemCard',
  '0.0.35 single item template: one product or service entry with image, two info rows, price, and actions.',
  [
    card('root', 'single-body'),
    column('single-body', [
      'single-titlebar',
      'single-product',
      'single-actions',
    ]),
    ...titleBar('single', '查看更多'),
    row('single-product', [
      'single-image',
      'single-copy',
    ], { align: 'start' }),
    image('single-image', productImage, 'smallFeature'),
    column('single-copy', [
      'single-heading-row',
      'single-info-1',
      'single-info-2',
      'single-price',
    ]),
    row('single-heading-row', [
      'single-heading',
      'single-chevron',
    ], { justify: 'spaceBetween' }),
    text('single-heading', '智能跑鞋 Pro', 'h3'),
    icon('single-chevron', 'arrow_forward'),
    text('single-info-1', '限时优惠 · 今日达', 'caption'),
    text('single-info-2', '运动装备 · 42 码', 'caption'),
    row('single-price', [
      'single-price-value',
      'single-quantity',
    ], { justify: 'spaceBetween' }),
    text('single-price-value', '券后 ¥4199', 'h3'),
    text('single-quantity', 'x1', 'caption'),
    row('single-actions', [
      'single-secondary',
      'single-primary',
    ]),
    ...button('single-secondary', '改规格', 'borderless'),
    ...button('single-primary', '去下单'),
  ],
);

const mediaLayoutCard = demo(
  'z-media-layout-card',
  'MediaLayoutCard',
  '0.0.35 media layout template: left media, middle title/info, right extra content, and bottom actions.',
  [
    card('root', 'media-body'),
    column('media-body', [
      'media-titlebar',
      'media-content',
      'media-actions',
    ]),
    ...titleBar('media', '更多'),
    row('media-content', [
      'media-image',
      'media-copy',
      'media-extra',
    ], { justify: 'spaceBetween', align: 'start' }),
    image('media-image', mediaImage, 'smallFeature'),
    column('media-copy', [
      'media-title',
      'media-info-1',
      'media-info-2',
    ]),
    text('media-title', '小程序开发助手', 'h3'),
    text('media-info-1', '提供开发、构建、调试和发布能力。', 'caption'),
    text('media-info-2', '最近更新：2 分钟前', 'caption'),
    card('media-extra', 'media-extra-copy', 'filled'),
    column('media-extra-copy', [
      'media-extra-label',
      'media-extra-value',
    ], 'center'),
    text('media-extra-label', '状态', 'caption'),
    text('media-extra-value', '可用', 'h4'),
    row('media-actions', [
      'media-secondary',
      'media-primary',
    ]),
    ...button('media-secondary', '取消', 'borderless'),
    ...button('media-primary', '确认'),
  ],
);

const priceActionListCard = demo(
  'z-price-action-list-card',
  'PriceActionListCard',
  '0.0.35 price action list template: multiple priced offers with row actions and a footer action.',
  [
    card('root', 'price-list-body'),
    column('price-list-body', [
      'price-list-titlebar',
      'price-list-items',
      'price-list-footer',
    ]),
    ...titleBar('price-list'),
    column('price-list-items', [
      'price-item-1',
      'price-item-2',
      'price-item-3',
    ]),
    ...[
      ['¥199', '热门', '含 3 次上门服务', '今晚可约'],
      ['¥299', '推荐', '含 5 次上门服务', '赠送一次保养'],
      ['¥499', '尊享', '一年权益包', '专属客服'],
    ].flatMap(([price, badge, line1, line2], index) => {
      const prefix = `price-item-${index + 1}`;
      return [
        card(prefix, `${prefix}-body`, 'outlined'),
        row(`${prefix}-body`, [
          `${prefix}-price-block`,
          `${prefix}-copy`,
          `${prefix}-action`,
        ], { justify: 'spaceBetween', align: 'center' }),
        column(`${prefix}-price-block`, [
          `${prefix}-price`,
          `${prefix}-badge`,
        ]),
        text(`${prefix}-price`, price ?? '', 'h3'),
        text(`${prefix}-badge`, badge ?? '', 'caption'),
        column(`${prefix}-copy`, [
          `${prefix}-line-1`,
          `${prefix}-line-2`,
        ]),
        text(`${prefix}-line-1`, line1 ?? '', 'body', 'medium'),
        text(`${prefix}-line-2`, line2 ?? '', 'caption'),
        ...button(`${prefix}-action`, '选择', 'borderless'),
      ];
    }),
    ...button('price-list-footer', '查看全部报价'),
  ],
);

const taskActionCard = demo(
  'z-task-action-card',
  'TaskActionCard',
  '0.0.35 task action template: a single full-width task button.',
  [
    card('root', 'task-body'),
    row('task-body', [
      'task-action-copy',
      'task-action-button',
    ], { justify: 'spaceBetween' }),
    column('task-action-copy', [
      'task-action-title',
      'task-action-desc',
    ]),
    text('task-action-title', '任务操作', 'h3'),
    text('task-action-desc', '查看状态更新并执行下一步。', 'caption'),
    ...button('task-action-button', '操作1'),
  ],
);

const orderCard = demo(
  'z-order-card',
  'OrderCard',
  '0.0.35 order card template: product summaries, order info, fees, total, and payment actions.',
  [
    card('root', 'order-body'),
    column('order-body', [
      'order-titlebar',
      'order-products',
      'order-info',
      'order-fees',
      'order-actions',
    ]),
    ...titleBar('order'),
    column('order-products', [
      'order-product-1',
      'order-product-2',
    ]),
    ...[
      ['order-product-1', '拿铁咖啡', '中杯 / 少冰', '¥5.8', 'x1'],
      ['order-product-2', '芝士贝果', '加热', '¥4.0', 'x2'],
    ].flatMap(([prefix, title, spec, price, quantity]) => [
      card(prefix ?? '', `${prefix}-body`, 'outlined'),
      row(`${prefix}-body`, [
        `${prefix}-copy`,
        `${prefix}-price`,
      ], { justify: 'spaceBetween', align: 'start' }),
      column(`${prefix}-copy`, [
        `${prefix}-title`,
        `${prefix}-spec`,
      ]),
      text(`${prefix}-title`, title ?? '', 'body', 'medium'),
      text(`${prefix}-spec`, spec ?? '', 'caption'),
      column(`${prefix}-price`, [
        `${prefix}-price-value`,
        `${prefix}-qty`,
      ], 'end'),
      text(`${prefix}-price-value`, price ?? '', 'body', 'medium'),
      text(`${prefix}-qty`, quantity ?? '', 'caption'),
    ]),
    column('order-info', [
      'order-info-1',
      'order-info-2',
    ]),
    ...infoRow('order-info-1', '取餐方式', '到店自取', '中关村创业大街店'),
    ...infoRow('order-info-2', '预计时间', '今天 18:30 前'),
    column('order-fees', [
      'order-fee-1',
      'order-fee-2',
      'order-discount',
      'order-total',
    ]),
    ...feeRow('order-fee-1', '运费', '¥3.0'),
    ...feeRow('order-fee-2', '打包费', '¥1.0'),
    text('order-discount', '已优惠 ¥2.0', 'caption'),
    row('order-total', [
      'order-total-label',
      'order-total-price',
    ], { justify: 'spaceBetween' }),
    text('order-total-label', '合计', 'h4'),
    text('order-total-price', '¥16.8', 'h2'),
    row('order-actions', [
      'order-secondary',
      'order-primary',
    ]),
    ...button('order-secondary', '修改订单', 'borderless'),
    ...button('order-primary', '去支付'),
  ],
);

const transportCard = demo(
  'z-transport-card',
  'TransportCard',
  '0.0.35 transport card template: a single route with departure, arrival, transfer hint, and price.',
  [
    action('root', 'transport-card-body'),
    card('transport-card-body', 'transport-body'),
    column('transport-body', [
      'transport-title',
      'transport-route',
      'transport-price-row',
    ]),
    text('transport-title', '北京南 - 上海虹桥', 'h3'),
    row('transport-route', [
      'transport-departure',
      'transport-transfer',
      'transport-arrival',
    ], { justify: 'spaceBetween', align: 'center' }),
    column('transport-departure', [
      'transport-departure-time',
      'transport-departure-station',
    ], 'start'),
    text('transport-departure-time', '08:00', 'h2'),
    text('transport-departure-station', '北京南', 'caption'),
    column('transport-transfer', [
      'transport-transfer-top',
      'transport-transfer-icon',
      'transport-transfer-bottom',
    ], 'center'),
    text('transport-transfer-top', '直达', 'caption'),
    icon('transport-transfer-icon', 'arrow_forward', 'primary'),
    text('transport-transfer-bottom', '4小时32分', 'caption'),
    column('transport-arrival', [
      'transport-arrival-time',
      'transport-arrival-station',
    ], 'end'),
    text('transport-arrival-time', '12:32 +1', 'h2'),
    text('transport-arrival-station', '上海虹桥', 'caption'),
    row('transport-price-row', [
      'transport-seat',
      'transport-price',
    ], { justify: 'spaceBetween' }),
    text('transport-seat', '二等座 · 有票', 'body', 'medium'),
    text('transport-price', '¥553', 'h2'),
  ],
);

const transportListCard = demo(
  'z-transport-list-card',
  'TransportListCard',
  '0.0.35 transport list template: multiple route candidates plus view-more affordance.',
  [
    card('root', 'transport-list-body'),
    column('transport-list-body', [
      'transport-list-titlebar',
      'transport-list-items',
      'transport-list-more',
    ]),
    ...titleBar('transport-list'),
    column('transport-list-items', [
      'transport-list-item-1-action',
      'transport-list-item-2-action',
      'transport-list-item-3-action',
      'transport-list-item-4-action',
    ]),
    ...[
      ['11:20', '16:00 +1', '¥553', '直达'],
      ['13:05', '18:10', '¥498', '换乘 1 次'],
      ['15:30', '20:05', '¥628', '商务优选'],
      ['19:10', '23:45', '¥521', '夜间班次'],
    ].flatMap(([start, end, price, transfer], index) => {
      const prefix = `transport-list-item-${index + 1}`;
      return [
        action(`${prefix}-action`, `${prefix}-card`),
        card(`${prefix}-card`, `${prefix}-body`, 'outlined'),
        column(`${prefix}-body`, [
          `${prefix}-title`,
          `${prefix}-times`,
        ]),
        text(`${prefix}-title`, '北京南 - 上海虹桥', 'h4'),
        row(`${prefix}-times`, [
          `${prefix}-depart`,
          `${prefix}-transfer`,
          `${prefix}-arrive`,
          `${prefix}-price`,
        ], { justify: 'spaceBetween' }),
        text(`${prefix}-depart`, start ?? '', 'h3'),
        text(`${prefix}-transfer`, transfer ?? '', 'caption'),
        text(`${prefix}-arrive`, end ?? '', 'h3'),
        text(`${prefix}-price`, price ?? '', 'h3'),
      ];
    }),
    ...button('transport-list-more', '查看更多'),
  ],
);

const ticketOrderCard = demo(
  'z-ticket-order-card',
  'TicketOrderCard',
  '0.0.35 ticket order template: route items, passenger/order info, fees, total, and actions.',
  [
    card('root', 'ticket-body'),
    column('ticket-body', [
      'ticket-titlebar',
      'ticket-routes',
      'ticket-info',
      'ticket-fees',
      'ticket-actions',
    ]),
    ...titleBar('ticket'),
    column('ticket-routes', [
      'ticket-route-1-action',
      'ticket-route-2-action',
    ]),
    ...[
      [
        'ticket-route-1',
        '出发地 - 到达地',
        '6月1日 周六 20:50-23:50 CZ0000 经济舱',
      ],
      [
        'ticket-route-2',
        '到达地 - 出发地',
        '6月3日 周一 14:50-18:50 CZ0001 经济舱',
      ],
    ].flatMap(([prefix, routeTitle, routeDesc]) => [
      action(`${prefix}-action`, `${prefix}-card`),
      card(`${prefix}-card`, `${prefix}-body`, 'outlined'),
      row(`${prefix}-body`, [
        `${prefix}-copy`,
        `${prefix}-icon`,
      ], { justify: 'spaceBetween' }),
      column(`${prefix}-copy`, [
        `${prefix}-title`,
        `${prefix}-desc`,
      ]),
      text(`${prefix}-title`, routeTitle ?? '', 'body', 'medium'),
      text(`${prefix}-desc`, routeDesc ?? '', 'caption'),
      icon(`${prefix}-icon`, 'arrow_forward'),
    ]),
    column('ticket-info', [
      'ticket-info-1',
      'ticket-info-2',
    ]),
    ...infoRow('ticket-info-1', '乘机人', '李雷', '身份证尾号 0823'),
    ...infoRow('ticket-info-2', '联系电话', '138****0000'),
    column('ticket-fees', [
      'ticket-fee-1',
      'ticket-fee-2',
      'ticket-total',
    ]),
    ...feeRow('ticket-fee-1', '票价', '¥1064'),
    ...feeRow('ticket-fee-2', '机建燃油', '¥440'),
    row('ticket-total', [
      'ticket-total-label',
      'ticket-total-price',
    ], { justify: 'spaceBetween' }),
    text('ticket-total-label', '合计', 'h4'),
    text('ticket-total-price', '¥1504', 'h2'),
    row('ticket-actions', [
      'ticket-secondary',
      'ticket-primary',
    ]),
    ...button('ticket-secondary', '返回修改', 'borderless'),
    ...button('ticket-primary', '确认出票'),
  ],
);

const invalidCard = demo(
  'z-invalid-card',
  'InvalidCard',
  '0.0.35 exported invalid card template: app title bar plus an expired or updated state row.',
  [
    card('root', 'invalid-body'),
    column('invalid-body', [
      'invalid-titlebar',
      'invalid-content',
    ]),
    ...titleBar('invalid'),
    action('invalid-content', 'invalid-row-card'),
    card('invalid-row-card', 'invalid-row', 'filled'),
    row('invalid-row', [
      'invalid-icon',
      'invalid-copy',
      'invalid-chevron',
    ], { justify: 'spaceBetween' }),
    icon('invalid-icon', 'info', 'primary'),
    column('invalid-copy', [
      'invalid-title',
      'invalid-desc',
    ]),
    text('invalid-title', '任务状态已更新', 'h4'),
    text('invalid-desc', '当前卡片内容已失效，请返回查看最新状态。', 'caption'),
    icon('invalid-chevron', 'arrow_forward'),
  ],
);

export const Z_TEMPLATE_DEMOS: ZTemplateDemo[] = [
  askHumanCard,
  listCard,
  singleItemCard,
  mediaLayoutCard,
  priceActionListCard,
  taskActionCard,
  orderCard,
  transportCard,
  transportListCard,
  ticketOrderCard,
  invalidCard,
];
