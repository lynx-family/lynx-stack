// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface OpenUIScenario {
  id: string;
  title: string;
  raw: string;
}

const NEW_LAYOUT_SHOWCASE_RAW =
  `root = Column([hero, layoutCard, listCard], "start", "stretch", "m")
hero = Card([Text("Layout Showcase", "h2"), Text("Row, Column, List and Divider compose a compact planning view.", "body")], "card", "column", false, "s", "start", "start")
layoutCard = Card([CardHeader("Release Roadmap", "Row and Column primitives"), statusRow, Divider("horizontal"), milestoneColumn], "card", "column", false, "m", "stretch", "start")
statusRow = Row([Text("Design", "h5"), Tag("In review"), Icon("arrow_forward", "sm", "muted"), Text("Build", "h5"), Tag("Active"), Icon("arrow_forward", "sm", "muted"), Text("Launch", "h5")], "between", "center", "s", true)
milestoneColumn = Column([Text("1. API shape finalized", "body"), Text("2. Playground coverage added", "body"), Text("3. Browser verification complete", "body")], "start", "stretch", "s")
listCard = Card([CardHeader("Checklist", "Tap each item to update local state"), List([CheckBox("Document usage snippets", true), CheckBox("Verify tabs and modal interactions", false), CheckBox("Confirm media placeholders render", false)], "vertical", "stretch", "s", true)], "sunk", "column", false, "m", "stretch", "start")`;

const NEW_INTERACTIVE_CONTROLS_RAW = `$plan = "Pro"
root = Column([header, tabs, modalLauncher], "start", "stretch", "m")
header = Card([Text("Interactive Controls", "h2"), Text("Tabs, ChoicePicker, DateTimeInput and Modal in one flow.", "body")], "card", "column", false, "s", "start", "start")
tabs = Tabs([{ value: "plan", title: "Plan", child: planCard }, { value: "schedule", title: "Schedule", child: scheduleCard }])
planCard = Card([CardHeader("Plan", "ChoicePicker updates local visual state"), ChoicePicker("Tier", ["Free", "Pro", "Team"], $plan, "card", "chips", true), Buttons([Button("Set Free", Action([@Set($plan, "Free")]), "secondary"), Button("Set Team", Action([@Set($plan, "Team")]), "primary")])], "sunk", "column", false, "m", "stretch", "start")
scheduleCard = Card([CardHeader("Schedule", "DateTimeInput displays date and time constraints"), DateTimeInput("2026-06-16T09:30:00", true, true, "2026-06-01", "2026-06-30", "Launch window")], "sunk", "column", false, "m", "stretch", "start")
modalContent = Card([Text("Confirmation", "h3"), Text("The modal renders arbitrary OpenUI content.", "body"), Button("Looks good", Action([@ToAssistant("Confirmed modal content")]), "primary")], "card", "column", false, "m", "stretch", "start")
modalLauncher = Modal(Button("Open confirmation", Action([@ToAssistant("Opened confirmation modal")]), "secondary"), modalContent, "Review details")`;

const NEW_MEDIA_CARDS_RAW =
  `root = Column([header, mediaTabs], "start", "stretch", "m")
header = Card([Text("Media Cards", "h2"), Text("AudioPlayer and Video provide lightweight media attachment surfaces.", "body")], "card", "column", false, "s", "start", "start")
mediaTabs = Tabs([{ value: "audio", title: "Audio", child: audioCard }, { value: "video", title: "Video", child: videoCard }])
audioCard = Card([CardHeader("Podcast Preview", "AudioPlayer placeholder"), AudioPlayer("https://example.com/openui-weekly.mp3", "OpenUI Weekly - catalog additions"), Row([Icon("pause", "sm", "muted"), Text("12 min episode", "caption"), Tag("Transcript ready")], "start", "center", "s", true)], "card", "column", false, "m", "stretch", "start")
videoCard = Card([CardHeader("Launch Walkthrough", "Video placeholder"), Video("https://example.com/openui-launch.mp4", "OpenUI component walkthrough"), List([Text("Covers layout primitives", "body"), Text("Shows tabs and modal", "body"), Text("Highlights media cards", "body")], "vertical", "stretch", "xs", true)], "card", "column", false, "m", "stretch", "start")`;

export const OPENUI_SCENARIOS: OpenUIScenario[] = [
  {
    id: 'new-layout-showcase',
    title: 'New Layout Showcase',
    raw: NEW_LAYOUT_SHOWCASE_RAW,
  },
  {
    id: 'new-interactive-controls',
    title: 'New Interactive Controls',
    raw: NEW_INTERACTIVE_CONTROLS_RAW,
  },
  {
    id: 'new-media-cards',
    title: 'New Media Cards',
    raw: NEW_MEDIA_CARDS_RAW,
  },
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
  },
];
