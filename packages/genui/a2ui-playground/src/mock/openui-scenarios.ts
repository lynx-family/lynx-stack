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
  {
    id: 'recipe-card',
    title: 'Recipe Card',
    raw:
      `root = Stack([heroCard, metaRow, ingredientsCard, tipCard, stepsCard, actionRow], "column", false, "l")

heroCard = Card([CardHeader("🍝  Tuscan White Bean Soup", "Rustic Italian comfort food ready in 30 minutes"), sourceRow], "card", "column", false, "l", "start", "start")
sourceRow = Stack([TextContent("🔒  Source verified: ", "small"), TextContent(true, "small")], "row", false, "none", "start", "start")

metaRow = Stack([Tag("⏱  30 min"), Tag("🍽  4 servings"), Tag("📊  Easy"), Tag("🌱  Vegetarian"), Tag("🔥  420 cal")], "row", true, "m", "stretch", "start")

ingredientsCard = Card([CardHeader("🥕  Ingredients", "Everything you need"), ingIntro, ingList], "sunk", "column", false, "m", "start", "start")
ingIntro = TextContent("Six simple items you probably already have.", "large")
ingList = Stack([ing1, ing2, ing3, ing4, ing5, ing6], "column", false, "xs", "start", "start")
ing1 = TextContent("•  2 cans cannellini beans, drained")
ing2 = TextContent("•  4 cloves garlic, minced")
ing3 = TextContent("•  1 bunch kale, chopped")
ing4 = TextContent("•  4 cups vegetable broth")
ing5 = TextContent("•  2 tbsp olive oil")
ing6 = TextContent("•  Salt, pepper, red pepper flakes")

tipCard = Card([Stack([TextContent("💡  Tip: ", "small-heavy"), TextContent("Day-old bread soaks up the broth beautifully.", "small")], "row", false, "xs", "start", "start")], "clear", "column", false, "xs", "start", "start")

stepsCard = Card([CardHeader("📝  Instructions", "Step by step"), stepList], "card", "column", false, "m", "start", "start")
stepList = Stack([step1, step2, step3, step4], "column", false, "m", "start", "start")
step1 = Stack([TextContent("1", "large-heavy"), TextContent("Sauté garlic in olive oil until fragrant, about 1 minute.")], "row", false, "m", "start", "start")
step2 = Stack([TextContent("2", "large-heavy"), TextContent("Add beans and broth. Simmer 15 minutes.")], "row", false, "m", "start", "start")
step3 = Stack([TextContent("3", "large-heavy"), TextContent("Stir in kale. Cook until wilted, 3 minutes.")], "row", false, "m", "start", "start")
step4 = Stack([TextContent("4", "large-heavy"), TextContent("Season to taste. Serve with crusty bread.", "default")], "row", false, "m", "start", "start")

actionRow = Stack([Buttons([Button("▶  Start Cooking", Action([@ToAssistant("Start cooking the Tuscan White Bean Soup")]), "primary", "normal", "large"), Button("🖨  Print", Action([@ToAssistant("Print this recipe")]), "secondary", "normal", "extra-small"), Button("💾  Save", Action([@ToAssistant("Save this recipe")]), "tertiary", "normal", "small"), Button("⏭  Skip", Action([@ToAssistant("Skip this recipe")]), "secondary", "destructive", "small")])], "row", false, "m", "start", "start")`,
    parsed:
      '{\n  "root": {\n    "type": "element",\n    "typeName": "Stack",\n    "props": {\n      "children": [\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🍝  Tuscan White Bean Soup",\n                  "subtitle": "Rustic Italian comfort food ready in 30 minutes"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "🔒  Source verified: ",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": true,\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    }\n                  ],\n                  "direction": "row",\n                  "wrap": false,\n                  "gap": "none",\n                  "align": "start",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "sourceRow"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "l",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "heroCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Stack",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "Tag",\n                "props": {\n                  "text": "⏱  30 min"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Tag",\n                "props": {\n                  "text": "🍽  4 servings"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Tag",\n                "props": {\n                  "text": "📊  Easy"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Tag",\n                "props": {\n                  "text": "🌱  Vegetarian"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Tag",\n                "props": {\n                  "text": "🔥  420 cal"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              }\n            ],\n            "direction": "row",\n            "wrap": true,\n            "gap": "m",\n            "align": "stretch",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "metaRow"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🥕  Ingredients",\n                  "subtitle": "Everything you need"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "TextContent",\n                "props": {\n                  "text": "Six simple items you probably already have.",\n                  "size": "large"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "ingIntro"\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "•  2 cans cannellini beans, drained"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "ing1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "•  4 cloves garlic, minced"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "ing2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "•  1 bunch kale, chopped"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "ing3"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "•  4 cups vegetable broth"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "ing4"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "•  2 tbsp olive oil"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "ing5"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "•  Salt, pepper, red pepper flakes"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "ing6"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "xs",\n                  "align": "start",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "ingList"\n              }\n            ],\n            "variant": "sunk",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "ingredientsCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "💡  Tip: ",\n                        "size": "small-heavy"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "Day-old bread soaks up the broth beautifully.",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    }\n                  ],\n                  "direction": "row",\n                  "wrap": false,\n                  "gap": "xs",\n                  "align": "start",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              }\n            ],\n            "variant": "clear",\n            "direction": "column",\n            "wrap": false,\n            "gap": "xs",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "tipCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "📝  Instructions",\n                  "subtitle": "Step by step"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "1",\n                              "size": "large-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Sauté garlic in olive oil until fragrant, about 1 minute."\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "step1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "2",\n                              "size": "large-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Add beans and broth. Simmer 15 minutes."\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "step2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "3",\n                              "size": "large-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Stir in kale. Cook until wilted, 3 minutes."\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "step3"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "4",\n                              "size": "large-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Season to taste. Serve with crusty bread.",\n                              "size": "default"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "step4"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "m",\n                  "align": "start",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "stepList"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "stepsCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Stack",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "Buttons",\n                "props": {\n                  "buttons": [\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "▶  Start Cooking",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Start cooking the Tuscan White Bean Soup"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "primary",\n                        "type": "normal",\n                        "size": "large"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "🖨  Print",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Print this recipe"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "secondary",\n                        "type": "normal",\n                        "size": "extra-small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "💾  Save",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Save this recipe"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "tertiary",\n                        "type": "normal",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "⏭  Skip",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Skip this recipe"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "secondary",\n                        "type": "destructive",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    }\n                  ]\n                },\n                "partial": false,\n                "hasDynamicProps": true\n              }\n            ],\n            "direction": "row",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": true,\n          "statementId": "actionRow"\n        }\n      ],\n      "direction": "column",\n      "wrap": false,\n      "gap": "l"\n    },\n    "partial": false,\n    "hasDynamicProps": true,\n    "statementId": "root"\n  },\n  "meta": {\n    "incomplete": false,\n    "unresolved": [],\n    "orphaned": [],\n    "statementCount": 21,\n    "errors": []\n  },\n  "stateDeclarations": {},\n  "queryStatements": [],\n  "mutationStatements": []\n}',
  },
  {
    id: 'travel-itinerary',
    title: 'Travel Itinerary',
    raw:
      `root = Stack([header, day1, day2, day3, footerRow], "column", false, "xl")

header = Card([CardHeader("🗺  Kyoto in 48 Hours")], "card", "column", false, "l", "start", "start")

day1 = Card([CardHeader("⛩️  Day 1 · Temples & Tradition", "April 12 · Saturday"), d1List], "card", "column", false, "m", "start", "start")
d1List = Stack([d1a1, d1a2, d1a3, d1a4], "column", false, "s")
d1a1 = Stack([TextContent("08:00", "small-heavy"), TextContent("Fushimi Inari Shrine · 2h")], "row", false, "m", "start", "start")
d1a2 = Stack([TextContent("11:00", "small-heavy"), TextContent("🍜  Nishiki Market lunch")], "row", false, "m", "start", "start")
d1a3 = Stack([TextContent("14:00", "small-heavy"), TextContent("✨  Kinkaku-ji Golden Pavilion")], "row", false, "m", "start", "start")
d1a4 = Stack([TextContent("15:30", "small-heavy"), TextContent("🚶  Gion district walk"), TextContent("Free time", "small")], "row", false, "m", "start", "start")

day2 = Card([CardHeader("🌿  Day 2 · Gardens & Geisha", "April 13 · Sunday"), d2List], "sunk", "column", false, "l", "start", "start")
d2List = Stack([d2a1, d2a2, d2a3, d2a4], "column", false, "s")
d2a1 = Stack([TextContent("09:00", "small-heavy"), TextContent("🎋  Arashiyama Bamboo Grove")], "row", false, "m", "start", "start")
d2a2 = Stack([TextContent("12:00", "small-heavy"), TextContent("🏯  Tenryu-ji Temple & Garden")], "row", false, "m", "start", "start")
d2a3 = Stack([TextContent("15:00", "small-heavy"), TextContent("🍵  Tea ceremony in Higashiyama")], "row", false, "m", "start", "start")
d2a4 = Stack([TextContent("19:00", "small-heavy"), TextContent("🍣  Pontocho Alley kaiseki")], "row", false, "m", "start", "start")

day3 = Card([CardHeader("🏙️  Day 3 · Modern Kyoto", "April 14 · Monday"), d3List], "card", "column", false, "xl", "start", "start")
d3List = Stack([d3a1, d3a2, d3a3], "column", false, "s")
d3a1 = Stack([TextContent("10:00", "small-heavy"), TextContent("🖼️  Kyoto National Museum")], "row", false, "m", "start", "start")
d3a2 = Stack([TextContent("13:00", "small-heavy"), TextContent("🌉  Nanzen-ji Aqueduct")], "row", false, "m", "start", "start")
d3a3 = Stack([TextContent("17:00", "small-heavy"), TextContent("🚄  Departure from Kyoto Station")], "row", false, "m", "start", "start")

footerRow = Stack([Stack([TextContent("☀  ", "small"), TextContent(22, "small-heavy"), TextContent("°C  Sunny", "small")], "row", false, "xs"), Button("✈️  Book This Trip", Action([@ToAssistant("Book this Kyoto itinerary")]), "primary", "normal", "large")], "row", true, "m", "start", "start")`,
    parsed:
      '{\n  "root": {\n    "type": "element",\n    "typeName": "Stack",\n    "props": {\n      "children": [\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🗺  Kyoto in 48 Hours"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "l",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "header"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "⛩️  Day 1 · Temples & Tradition",\n                  "subtitle": "April 12 · Saturday"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "08:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Fushimi Inari Shrine · 2h"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d1a1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "11:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🍜  Nishiki Market lunch"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d1a2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "14:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "✨  Kinkaku-ji Golden Pavilion"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d1a3"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "15:30",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🚶  Gion district walk"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Free time",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d1a4"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "s"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "d1List"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "day1"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🌿  Day 2 · Gardens & Geisha",\n                  "subtitle": "April 13 · Sunday"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "09:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🎋  Arashiyama Bamboo Grove"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d2a1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "12:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🏯  Tenryu-ji Temple & Garden"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d2a2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "15:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🍵  Tea ceremony in Higashiyama"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d2a3"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "19:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🍣  Pontocho Alley kaiseki"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d2a4"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "s"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "d2List"\n              }\n            ],\n            "variant": "sunk",\n            "direction": "column",\n            "wrap": false,\n            "gap": "l",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "day2"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🏙️  Day 3 · Modern Kyoto",\n                  "subtitle": "April 14 · Monday"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "10:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🖼️  Kyoto National Museum"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d3a1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "13:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🌉  Nanzen-ji Aqueduct"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d3a2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "17:00",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🚄  Departure from Kyoto Station"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "d3a3"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "s"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "d3List"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "xl",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "day3"\n        },\n        {\n          "type": "element",\n          "typeName": "Stack",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "☀  ",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": 22,\n                        "size": "small-heavy"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "TextContent",\n                      "props": {\n                        "text": "°C  Sunny",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    }\n                  ],\n                  "direction": "row",\n                  "wrap": false,\n                  "gap": "xs"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Button",\n                "props": {\n                  "label": "✈️  Book This Trip",\n                  "action": {\n                    "k": "Comp",\n                    "name": "Action",\n                    "args": [\n                      {\n                        "k": "Arr",\n                        "els": [\n                          {\n                            "k": "Comp",\n                            "name": "ToAssistant",\n                            "args": [\n                              {\n                                "k": "Str",\n                                "v": "Book this Kyoto itinerary"\n                              }\n                            ]\n                          }\n                        ]\n                      }\n                    ]\n                  },\n                  "variant": "primary",\n                  "type": "normal",\n                  "size": "large"\n                },\n                "partial": false,\n                "hasDynamicProps": true\n              }\n            ],\n            "direction": "row",\n            "wrap": true,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": true,\n          "statementId": "footerRow"\n        }\n      ],\n      "direction": "column",\n      "wrap": false,\n      "gap": "xl"\n    },\n    "partial": false,\n    "hasDynamicProps": true,\n    "statementId": "root"\n  },\n  "meta": {\n    "incomplete": false,\n    "unresolved": [],\n    "orphaned": [],\n    "statementCount": 20,\n    "errors": []\n  },\n  "stateDeclarations": {},\n  "queryStatements": [],\n  "mutationStatements": []\n}',
  },
  {
    id: 'music-album',
    title: 'Music Album',
    raw:
      `root = Stack([heroCard, albumNotesCard, trackListCard, actionRow], "column", false, "l")

heroCard = Card([CardHeader("🎧  Midnight Drive", "Lena Park"), metaRow], "card", "column", false, "m", "start", "start")

metaRow = Stack([Tag("🎵  Synthwave"), Tag("💿  Studio Album"), Tag("🗓  2024"), Tag("⏱  47 min")], "row", true, "m", "stretch", "start")

albumNotesCard = Card([CardHeader("🌙  Album Notes", "Late-night synths with cinematic hooks"), albumNotes], "sunk", "column", false, "m", "start", "start")
albumNotes = Stack([note1, note2, note3], "column", false, "s", "start", "start")
note1 = Stack([TextContent("⭐  Rating", "small-heavy"), TextContent("4.7 / 5 from 12.8k listeners", "small")], "column", false, "xs")
note2 = Stack([TextContent("🌃  Mood", "small-heavy"), TextContent("Neon-lit, moody, and built for night drives", "small")], "column", false, "xs")
note3 = Stack([TextContent("🎶  Highlights", "small-heavy"), TextContent("Includes 'Neon Skyline' and 'Moonlit Run'", "small")], "column", false, "xs")

trackListCard = Card([CardHeader("🎼  Tracklist", "8 tracks"), tracksList], "card", "column", false, "m", "start", "start")
tracksList = Stack([t1, Separator(), t2, Separator(), t3, Separator(), t4, Separator(), t5, Separator(), t6, Separator(), t7, Separator(), t8], "column", false, "s")
t1 = Stack([TextContent("01", "small-heavy"), TextContent("Neon Skyline"), TextContent("4:12", "small")], "row", false, "m", "start", "start")
t2 = Stack([TextContent("02", "small-heavy"), TextContent("After Hours"), TextContent("3:48", "small")], "row", false, "m", "start", "start")
t3 = Stack([TextContent("03", "small-heavy"), TextContent("Echo Chamber"), TextContent("5:01", "small")], "row", false, "m", "start", "start")
t4 = Stack([TextContent("04", "small-heavy"), TextContent("Glass Tower"), TextContent("4:33", "small")], "row", false, "m", "start", "start")
t5 = Stack([TextContent("05", "small-heavy"), TextContent("Cobalt"), TextContent("3:57", "small")], "row", false, "m", "start", "start")
t6 = Stack([TextContent("06", "small-heavy"), TextContent("Lost Highway"), TextContent("4:45", "small")], "row", false, "m", "start", "start")
t7 = Stack([TextContent("07", "small-heavy"), TextContent("Moonlit Run"), TextContent("4:08", "small")], "row", false, "m", "start", "start")
t8 = Stack([TextContent("08", "small-heavy"), TextContent("Fade Out"), TextContent("6:24", "small")], "row", false, "m", "start", "start")

actionRow = Stack([Buttons([Button("▶  Play Album", Action([@ToAssistant("Play the Midnight Drive album")]), "primary", "normal", "large"), Button("💾  Save", Action([@ToAssistant("Save Midnight Drive to library")]), "secondary", "normal", "medium"), Button("🔗  Share", Action([@ToAssistant("Share Midnight Drive")]), "tertiary", "normal", "small"), Button("⋯  More", Action([@ToAssistant("Show more actions for Midnight Drive")]), "secondary", "normal", "small")])], "row", false, "m", "start", "start")`,
    parsed:
      '{\n  "root": {\n    "type": "element",\n    "typeName": "Stack",\n    "props": {\n      "children": [\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🎧  Midnight Drive",\n                  "subtitle": "Lena Park"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "🎵  Synthwave"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "💿  Studio Album"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "🗓  2024"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "⏱  47 min"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    }\n                  ],\n                  "direction": "row",\n                  "wrap": true,\n                  "gap": "m",\n                  "align": "stretch",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "metaRow"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "heroCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🌙  Album Notes",\n                  "subtitle": "Late-night synths with cinematic hooks"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "⭐  Rating",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "4.7 / 5 from 12.8k listeners",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "note1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🌃  Mood",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Neon-lit, moody, and built for night drives",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "note2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🎶  Highlights",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Includes \'Neon Skyline\' and \'Moonlit Run\'",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "note3"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "s",\n                  "align": "start",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "albumNotes"\n              }\n            ],\n            "variant": "sunk",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "albumNotesCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🎼  Tracklist",\n                  "subtitle": "8 tracks"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "01",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Neon Skyline"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "4:12",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "02",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "After Hours"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "3:48",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "03",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Echo Chamber"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "5:01",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t3"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "04",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Glass Tower"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "4:33",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t4"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "05",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Cobalt"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "3:57",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t5"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "06",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Lost Highway"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "4:45",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t6"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "07",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Moonlit Run"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "4:08",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t7"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "08",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Fade Out"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "6:24",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "row",\n                        "wrap": false,\n                        "gap": "m",\n                        "align": "start",\n                        "justify": "start"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "t8"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "s"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "tracksList"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "trackListCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Stack",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "Buttons",\n                "props": {\n                  "buttons": [\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "▶  Play Album",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Play the Midnight Drive album"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "primary",\n                        "type": "normal",\n                        "size": "large"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "💾  Save",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Save Midnight Drive to library"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "secondary",\n                        "type": "normal",\n                        "size": "medium"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "🔗  Share",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Share Midnight Drive"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "tertiary",\n                        "type": "normal",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "⋯  More",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Show more actions for Midnight Drive"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "secondary",\n                        "type": "normal",\n                        "size": "small"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    }\n                  ]\n                },\n                "partial": false,\n                "hasDynamicProps": true\n              }\n            ],\n            "direction": "row",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": true,\n          "statementId": "actionRow"\n        }\n      ],\n      "direction": "column",\n      "wrap": false,\n      "gap": "l"\n    },\n    "partial": false,\n    "hasDynamicProps": true,\n    "statementId": "root"\n  },\n  "meta": {\n    "incomplete": false,\n    "unresolved": [],\n    "orphaned": [],\n    "statementCount": 19,\n    "errors": []\n  },\n  "stateDeclarations": {},\n  "queryStatements": [],\n  "mutationStatements": []\n}',
  },
  {
    id: 'user-profile',
    title: 'User Profile',
    raw:
      `root = Stack([profileCard, statsCard, bioCard, activityCard, actionRow], "column", false, "l")

profileCard = Card([CardHeader("👩‍💻  Maya Chen", "Senior Frontend Engineer"), profileMeta], "card", "column", false, "m", "start", "start")
profileMeta = Stack([Tag("📍  San Francisco"), Tag("⚛️  React"), Tag("🧩  Design Systems"), Tag("⏳  8 yrs exp")], "row", true, "m", "stretch", "start")

statsCard = Card([CardHeader("📊  Stats", "At a glance"), statsRow], "sunk", "column", false, "m", "start", "start")
statsRow = Stack([Stack([TextContent("8.4k", "large-heavy"), TextContent("👥  followers", "small")], "column", false, "xs"), Stack([TextContent(142, "large-heavy"), TextContent("📝  posts", "small")], "column", false, "xs"), Stack([TextContent(312, "large-heavy"), TextContent("➡️  following", "small")], "column", false, "xs")], "row", true, "l", "stretch", "start")

bioCard = Card([CardHeader("🪪  About", "A few words"), bioText], "card", "column", false, "m", "start", "start")
bioText = TextContent("Building thoughtful interfaces with React and TypeScript. Previously at Linear and Vercel. Open-source contributor focused on design systems and developer tooling.", "default")

activityCard = Card([CardHeader("🕒  Recent Activity", "What she's been up to"), activityList], "card", "column", false, "m", "stretch", "start")
activityList = Stack([act1, Separator(), act2, Separator(), act3], "column", false, "s")
act1 = Stack([TextContent("💬  Replied to a thread on design systems", "small-heavy"), TextContent("2 hours ago", "small")], "column", false, "xs")
act2 = Stack([TextContent("🚀  Shipped v2.0 of use-open-ui", "small-heavy"), TextContent("Yesterday", "default")], "column", false, "xs")
act3 = Stack([TextContent("✍️  Published 'Edge rendering with Lynx'", "small-heavy"), TextContent("3 days ago", "small")], "column", false, "xs")

actionRow = Stack([Buttons([Button("➕  Follow", Action([@ToAssistant("Follow Maya Chen")]), "primary", "normal", "large"), Button("✉️  Message", Action([@ToAssistant("Send Maya a message")]), "secondary", "normal", "medium")])], "row", false, "m", "start", "start")`,
    parsed:
      '{\n  "root": {\n    "type": "element",\n    "typeName": "Stack",\n    "props": {\n      "children": [\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "👩‍💻  Maya Chen",\n                  "subtitle": "Senior Frontend Engineer"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "📍  San Francisco"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "⚛️  React"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "🧩  Design Systems"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Tag",\n                      "props": {\n                        "text": "⏳  8 yrs exp"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    }\n                  ],\n                  "direction": "row",\n                  "wrap": true,\n                  "gap": "m",\n                  "align": "stretch",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "profileMeta"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "profileCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "📊  Stats",\n                  "subtitle": "At a glance"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "8.4k",\n                              "size": "large-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "👥  followers",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": 142,\n                              "size": "large-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "📝  posts",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": 312,\n                              "size": "large-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "➡️  following",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false\n                    }\n                  ],\n                  "direction": "row",\n                  "wrap": true,\n                  "gap": "l",\n                  "align": "stretch",\n                  "justify": "start"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "statsRow"\n              }\n            ],\n            "variant": "sunk",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "statsCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🪪  About",\n                  "subtitle": "A few words"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "TextContent",\n                "props": {\n                  "text": "Building thoughtful interfaces with React and TypeScript. Previously at Linear and Vercel. Open-source contributor focused on design systems and developer tooling.",\n                  "size": "default"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "bioText"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "bioCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Card",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "CardHeader",\n                "props": {\n                  "title": "🕒  Recent Activity",\n                  "subtitle": "What she\'s been up to"\n                },\n                "partial": false,\n                "hasDynamicProps": false\n              },\n              {\n                "type": "element",\n                "typeName": "Stack",\n                "props": {\n                  "children": [\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "💬  Replied to a thread on design systems",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "2 hours ago",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "act1"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "🚀  Shipped v2.0 of use-open-ui",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "Yesterday",\n                              "size": "default"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "act2"\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Separator",\n                      "props": {},\n                      "partial": false,\n                      "hasDynamicProps": false\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Stack",\n                      "props": {\n                        "children": [\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "✍️  Published \'Edge rendering with Lynx\'",\n                              "size": "small-heavy"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          },\n                          {\n                            "type": "element",\n                            "typeName": "TextContent",\n                            "props": {\n                              "text": "3 days ago",\n                              "size": "small"\n                            },\n                            "partial": false,\n                            "hasDynamicProps": false\n                          }\n                        ],\n                        "direction": "column",\n                        "wrap": false,\n                        "gap": "xs"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": false,\n                      "statementId": "act3"\n                    }\n                  ],\n                  "direction": "column",\n                  "wrap": false,\n                  "gap": "s"\n                },\n                "partial": false,\n                "hasDynamicProps": false,\n                "statementId": "activityList"\n              }\n            ],\n            "variant": "card",\n            "direction": "column",\n            "wrap": false,\n            "gap": "m",\n            "align": "stretch",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": false,\n          "statementId": "activityCard"\n        },\n        {\n          "type": "element",\n          "typeName": "Stack",\n          "props": {\n            "children": [\n              {\n                "type": "element",\n                "typeName": "Buttons",\n                "props": {\n                  "buttons": [\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "➕  Follow",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Follow Maya Chen"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "primary",\n                        "type": "normal",\n                        "size": "large"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    },\n                    {\n                      "type": "element",\n                      "typeName": "Button",\n                      "props": {\n                        "label": "✉️  Message",\n                        "action": {\n                          "k": "Comp",\n                          "name": "Action",\n                          "args": [\n                            {\n                              "k": "Arr",\n                              "els": [\n                                {\n                                  "k": "Comp",\n                                  "name": "ToAssistant",\n                                  "args": [\n                                    {\n                                      "k": "Str",\n                                      "v": "Send Maya a message"\n                                    }\n                                  ]\n                                }\n                              ]\n                            }\n                          ]\n                        },\n                        "variant": "secondary",\n                        "type": "normal",\n                        "size": "medium"\n                      },\n                      "partial": false,\n                      "hasDynamicProps": true\n                    }\n                  ]\n                },\n                "partial": false,\n                "hasDynamicProps": true\n              }\n            ],\n            "direction": "row",\n            "wrap": false,\n            "gap": "m",\n            "align": "start",\n            "justify": "start"\n          },\n          "partial": false,\n          "hasDynamicProps": true,\n          "statementId": "actionRow"\n        }\n      ],\n      "direction": "column",\n      "wrap": false,\n      "gap": "l"\n    },\n    "partial": false,\n    "hasDynamicProps": true,\n    "statementId": "root"\n  },\n  "meta": {\n    "incomplete": false,\n    "unresolved": [],\n    "orphaned": [],\n    "statementCount": 13,\n    "errors": []\n  },\n  "stateDeclarations": {},\n  "queryStatements": [],\n  "mutationStatements": []\n}',
  },
  {
    id: 'simple-hello-world',
    title: 'Simple Hello World',
    raw: `root = Card([styles], "card", "column", false, "m", "start", "start")

styles = Stack([smallWord, defaultWord, largeWord, smallHeavyWord, largeHeavyWord], "column", false, "s", "start", "start")
smallWord = TextContent("👋 Hello small", "small")
defaultWord = TextContent("🙂 Hello default", "default")
largeWord = TextContent("✨ Hello large", "large")
smallHeavyWord = TextContent("💪 Hello small-heavy", "small-heavy")
largeHeavyWord = TextContent("🚀 Hello large-heavy", "large-heavy")`,
    parsed: JSON.stringify(
      {
        root: {
          type: 'element',
          typeName: 'Card',
          props: {
            children: [
              {
                type: 'element',
                typeName: 'Stack',
                props: {
                  children: [
                    {
                      type: 'element',
                      typeName: 'TextContent',
                      props: {
                        text: '👋 Hello small',
                        size: 'small',
                      },
                      partial: false,
                      hasDynamicProps: false,
                      statementId: 'smallWord',
                    },
                    {
                      type: 'element',
                      typeName: 'TextContent',
                      props: {
                        text: '🙂 Hello default',
                        size: 'default',
                      },
                      partial: false,
                      hasDynamicProps: false,
                      statementId: 'defaultWord',
                    },
                    {
                      type: 'element',
                      typeName: 'TextContent',
                      props: {
                        text: '✨ Hello large',
                        size: 'large',
                      },
                      partial: false,
                      hasDynamicProps: false,
                      statementId: 'largeWord',
                    },
                    {
                      type: 'element',
                      typeName: 'TextContent',
                      props: {
                        text: '💪 Hello small-heavy',
                        size: 'small-heavy',
                      },
                      partial: false,
                      hasDynamicProps: false,
                      statementId: 'smallHeavyWord',
                    },
                    {
                      type: 'element',
                      typeName: 'TextContent',
                      props: {
                        text: '🚀 Hello large-heavy',
                        size: 'large-heavy',
                      },
                      partial: false,
                      hasDynamicProps: false,
                      statementId: 'largeHeavyWord',
                    },
                  ],
                  direction: 'column',
                  wrap: false,
                  gap: 's',
                  align: 'start',
                  justify: 'start',
                },
                partial: false,
                hasDynamicProps: false,
                statementId: 'styles',
              },
            ],
            variant: 'card',
            direction: 'column',
            wrap: false,
            gap: 'm',
            align: 'start',
            justify: 'start',
          },
          partial: false,
          hasDynamicProps: false,
          statementId: 'root',
        },
        meta: {
          incomplete: false,
          unresolved: [],
          orphaned: [],
          statementCount: 6,
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
