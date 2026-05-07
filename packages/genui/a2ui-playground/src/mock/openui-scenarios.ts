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
          type: 'Stack',
          direction: 'column',
          spacing: 'l',
          align: 'center',
          children: ['header', 'cards'],
        },
        header: {
          type: 'TextContent',
          text: 'Choose Your Plan',
          variant: 'large-heavy',
        },
        cards: {
          type: 'Stack',
          direction: 'row',
          spacing: 'l',
          align: 'stretch',
          children: ['freeCard', 'proCard', 'enterpriseCard'],
        },
      },
      null,
      2,
    ),
  },
];
