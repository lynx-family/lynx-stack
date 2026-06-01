// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface OpenUIScenario {
  id: string;
  title: string;
  raw: string;
  parsed: string;
}

export const OPENUI_SCENARIOS: OpenUIScenario[] = [
  {
    id: 'pricing-cards',
    title: 'Pricing Cards',
    raw: `root = Stack([header, cards], "column", "l", "center")
header = TextContent("Choose Your Plan", "large-heavy")
cards = Stack([freeCard, proCard, enterpriseCard], "row", "l", "stretch")

freeCard = Card([freeHeader, freePrice, freeSep, freeFeatures, freeBtn], "card", "column", "stretch", "between")
freeHeader = CardHeader("Free", "For individuals just getting started")
freePrice = Stack([freePriceAmt, freePricePer], "row", "none", "baseline")
freePriceAmt = TextContent("$0", "large-heavy")
freePricePer = TextContent(" / month", "small")
freeSep = Separator("horizontal", true)
freeFeatures = Stack([ff1, ff2, ff3, ff4], "column", "s")
ff1 = TextContent("✓  1 user")
ff2 = TextContent("✓  5 projects")
ff3 = TextContent("✓  2 GB storage")
ff4 = TextContent("✗  Priority support")
freeBtn = Buttons([Button("Get Started", Action([@ToAssistant("Get started with Free plan")]), "secondary")])

proCard = Card([proHeader, proPrice, proBadge, proSep, proFeatures, proBtn], "card", "column", "stretch", "between")
proHeader = CardHeader("Pro", "For growing teams and professionals")
proPrice = Stack([proPriceAmt, proPricePer], "row", "none", "baseline")
proPriceAmt = TextContent("$29", "large-heavy")
proPricePer = TextContent(" / month", "small")
proBadge = Tag("Most Popular", null, "sm", "info")
proSep = Separator("horizontal", true)
proFeatures = Stack([pf1, pf2, pf3, pf4, pf5], "column", "s")
pf1 = TextContent("✓  Up to 10 users")
pf2 = TextContent("✓  Unlimited projects")
pf3 = TextContent("✓  50 GB storage")
pf4 = TextContent("✓  Priority support")
pf5 = TextContent("✓  Advanced analytics")
proBtn = Buttons([Button("Start Free Trial", Action([@ToAssistant("Start free trial with Pro plan")]), "primary")])

enterpriseCard = Card([entHeader, entPrice, entSep, entFeatures, entBtn], "card", "column", "stretch", "between")
entHeader = CardHeader("Enterprise", "For large organizations at scale")
entPrice = Stack([entPriceAmt, entPricePer], "row", "none", "baseline")
entPriceAmt = TextContent("$99", "large-heavy")
entPricePer = TextContent(" / month", "small")
entSep = Separator("horizontal", true)
entFeatures = Stack([ef1, ef2, ef3, ef4, ef5, ef6], "column", "s")
ef1 = TextContent("✓  Unlimited users")
ef2 = TextContent("✓  Unlimited projects")
ef3 = TextContent("✓  1 TB storage")
ef4 = TextContent("✓  24/7 dedicated support")
ef5 = TextContent("✓  Advanced analytics")
ef6 = TextContent("✓  Custom integrations")
entBtn = Buttons([Button("Contact Sales", Action([@ToAssistant("Contact sales for Enterprise plan")]), "secondary")])`,
    parsed: JSON.stringify(
      {
        root: {
          type: 'element',
          typeName: 'Stack',
          props: {
            children: [
              {
                type: 'element',
                typeName: 'TextContent',
                props: {
                  text: 'Choose Your Plan',
                  size: 'large-heavy',
                },
                partial: false,
                hasDynamicProps: false,
                statementId: 'header',
              },
              {
                type: 'element',
                typeName: 'Stack',
                props: {
                  children: [
                    {
                      type: 'element',
                      typeName: 'Card',
                      props: {
                        children: [
                          {
                            type: 'element',
                            typeName: 'CardHeader',
                            props: {
                              title: 'Starter',
                              subtitle:
                                'Perfect for individuals and small projects',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'starterHeader',
                          },
                          {
                            type: 'element',
                            typeName: 'Stack',
                            props: {
                              children: [
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: {
                                    text: '$9',
                                    size: 'large-heavy',
                                  },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'starterAmount',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: {
                                    text: '/ month',
                                    size: 'small',
                                  },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'starterPeriod',
                                },
                              ],
                              direction: 'row',
                              gap: 'baseline',
                              align: 'start',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'starterPrice',
                          },
                          {
                            type: 'element',
                            typeName: 'Separator',
                            props: {
                              orientation: 'horizontal',
                              decorative: true,
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'starterSep',
                          },
                          {
                            type: 'element',
                            typeName: 'Stack',
                            props: {
                              children: [
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  5 Projects' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'sf1',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  10 GB Storage' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'sf2',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Email Support' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'sf3',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✗  Custom Domain' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'sf4',
                                },
                              ],
                              direction: 'column',
                              gap: 's',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'starterFeatures',
                          },
                          {
                            type: 'element',
                            typeName: 'Buttons',
                            props: {
                              buttons: [
                                {
                                  type: 'element',
                                  typeName: 'Button',
                                  props: {
                                    label: 'Get Started',
                                    action: {
                                      k: 'Comp',
                                      name: 'Action',
                                      args: [
                                        {
                                          k: 'Arr',
                                          els: [
                                            {
                                              k: 'Comp',
                                              name: 'ToAssistant',
                                              args: [
                                                {
                                                  k: 'Str',
                                                  v: 'I\'d like the Starter plan',
                                                },
                                              ],
                                            },
                                          ],
                                        },
                                      ],
                                    },
                                    variant: 'secondary',
                                  },
                                  partial: false,
                                  hasDynamicProps: true,
                                },
                              ],
                            },
                            partial: false,
                            hasDynamicProps: true,
                            statementId: 'starterBtn',
                          },
                        ],
                        variant: 'card',
                        direction: 'column',
                        gap: 'stretch',
                        align: 'between',
                      },
                      partial: false,
                      hasDynamicProps: true,
                      statementId: 'starterCard',
                    },
                    {
                      type: 'element',
                      typeName: 'Card',
                      props: {
                        children: [
                          {
                            type: 'element',
                            typeName: 'Tag',
                            props: {
                              text: 'Most Popular',
                              icon: null,
                              size: 'sm',
                              variant: 'info',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'proTag',
                          },
                          {
                            type: 'element',
                            typeName: 'CardHeader',
                            props: {
                              title: 'Pro',
                              subtitle:
                                'Great for growing teams and businesses',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'proHeader',
                          },
                          {
                            type: 'element',
                            typeName: 'Stack',
                            props: {
                              children: [
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '$29', size: 'large-heavy' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'proAmount',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '/ month', size: 'small' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'proPeriod',
                                },
                              ],
                              direction: 'row',
                              gap: 'baseline',
                              align: 'start',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'proPrice',
                          },
                          {
                            type: 'element',
                            typeName: 'Separator',
                            props: {
                              orientation: 'horizontal',
                              decorative: true,
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'proSep',
                          },
                          {
                            type: 'element',
                            typeName: 'Stack',
                            props: {
                              children: [
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Unlimited Projects' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'pf1',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  100 GB Storage' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'pf2',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Priority Support' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'pf3',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Custom Domain' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'pf4',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Analytics Dashboard' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'pf5',
                                },
                              ],
                              direction: 'column',
                              gap: 's',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'proFeatures',
                          },
                          {
                            type: 'element',
                            typeName: 'Buttons',
                            props: {
                              buttons: [
                                {
                                  type: 'element',
                                  typeName: 'Button',
                                  props: {
                                    label: 'Get Started',
                                    action: {
                                      k: 'Comp',
                                      name: 'Action',
                                      args: [
                                        {
                                          k: 'Arr',
                                          els: [
                                            {
                                              k: 'Comp',
                                              name: 'ToAssistant',
                                              args: [
                                                {
                                                  k: 'Str',
                                                  v: 'I\'d like the Pro plan',
                                                },
                                              ],
                                            },
                                          ],
                                        },
                                      ],
                                    },
                                    variant: 'primary',
                                  },
                                  partial: false,
                                  hasDynamicProps: true,
                                },
                              ],
                            },
                            partial: false,
                            hasDynamicProps: true,
                            statementId: 'proBtn',
                          },
                        ],
                        variant: 'card',
                        direction: 'column',
                        gap: 'stretch',
                        align: 'between',
                      },
                      partial: false,
                      hasDynamicProps: true,
                      statementId: 'proCard',
                    },
                    {
                      type: 'element',
                      typeName: 'Card',
                      props: {
                        children: [
                          {
                            type: 'element',
                            typeName: 'CardHeader',
                            props: {
                              title: 'Enterprise',
                              subtitle: 'For large-scale operations and teams',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'enterpriseHeader',
                          },
                          {
                            type: 'element',
                            typeName: 'Stack',
                            props: {
                              children: [
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '$99', size: 'large-heavy' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'enterpriseAmount',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '/ month', size: 'small' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'enterprisePeriod',
                                },
                              ],
                              direction: 'row',
                              gap: 'baseline',
                              align: 'start',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'enterprisePrice',
                          },
                          {
                            type: 'element',
                            typeName: 'Separator',
                            props: {
                              orientation: 'horizontal',
                              decorative: true,
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'enterpriseSep',
                          },
                          {
                            type: 'element',
                            typeName: 'Stack',
                            props: {
                              children: [
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Unlimited Projects' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'ef1',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  1 TB Storage' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'ef2',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  24/7 Dedicated Support' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'ef3',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Custom Domain' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'ef4',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  Advanced Analytics' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'ef5',
                                },
                                {
                                  type: 'element',
                                  typeName: 'TextContent',
                                  props: { text: '✓  SSO & Security Audit' },
                                  partial: false,
                                  hasDynamicProps: false,
                                  statementId: 'ef6',
                                },
                              ],
                              direction: 'column',
                              gap: 's',
                            },
                            partial: false,
                            hasDynamicProps: false,
                            statementId: 'enterpriseFeatures',
                          },
                          {
                            type: 'element',
                            typeName: 'Buttons',
                            props: {
                              buttons: [
                                {
                                  type: 'element',
                                  typeName: 'Button',
                                  props: {
                                    label: 'Contact Sales',
                                    action: {
                                      k: 'Comp',
                                      name: 'Action',
                                      args: [
                                        {
                                          k: 'Arr',
                                          els: [
                                            {
                                              k: 'Comp',
                                              name: 'ToAssistant',
                                              args: [
                                                {
                                                  k: 'Str',
                                                  v: 'I\'d like to learn about the Enterprise plan',
                                                },
                                              ],
                                            },
                                          ],
                                        },
                                      ],
                                    },
                                    variant: 'secondary',
                                  },
                                  partial: false,
                                  hasDynamicProps: true,
                                },
                              ],
                            },
                            partial: false,
                            hasDynamicProps: true,
                            statementId: 'enterpriseBtn',
                          },
                        ],
                        variant: 'card',
                        direction: 'column',
                        gap: 'stretch',
                        align: 'between',
                      },
                      partial: false,
                      hasDynamicProps: true,
                      statementId: 'enterpriseCard',
                    },
                  ],
                  direction: 'row',
                  gap: 'l',
                  align: 'center',
                },
                partial: false,
                hasDynamicProps: true,
                statementId: 'cards',
              },
            ],
            direction: 'column',
            gap: 'l',
            align: 'center',
          },
          partial: false,
          hasDynamicProps: true,
          statementId: 'root',
        },
        meta: {
          incomplete: false,
          unresolved: [],
          orphaned: [],
          statementCount: 43,
          errors: [],
        },
        stateDeclarations: {},
        queryStatements: [],
        mutationStatements: [],
      },
      null,
      2,
    ),
  },
];
