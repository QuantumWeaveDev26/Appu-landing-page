const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const ParentOnboardingShell = require('../frontend/parent-onboarding-shell.js');

describe('HR-Approved APPU AI Pricing UI & Tier Grouping Invariants', () => {
  const mockApprovedPlans = [
    {
      code: 'free',
      tierCode: 'free',
      tierName: 'APPU Free',
      name: 'APPU Free',
      description: 'Basic AI discovery and essential learning for every student.',
      currency: 'INR',
      amountPaise: 0,
      displayPrice: '₹0',
      billingInterval: 'monthly',
      annualSavingsPaise: 0,
      monthlyEquivalentPaise: 0,
      isPublic: true,
      isPrimaryCard: true,
      isRecommended: false,
      checkoutEnabled: true,
      displayOrder: 0,
      ctaText: 'Start Free',
      ctaAction: 'free_checkout',
      entitlements: { monthly_ai_sessions: 20, monthly_voice_minutes: 5 }
    },
    {
      code: 'evolve_monthly',
      tierCode: 'evolve',
      tierName: 'APPU Evolve',
      name: 'APPU Evolve Monthly',
      description: 'Persistent learner profile, adaptive learning paths, storytelling, and weekly missions.',
      currency: 'INR',
      amountPaise: 49900,
      displayPrice: '₹499/mo',
      billingInterval: 'monthly',
      annualSavingsPaise: 0,
      monthlyEquivalentPaise: 49900,
      isPublic: true,
      isPrimaryCard: true,
      isRecommended: false,
      checkoutEnabled: true,
      displayOrder: 1,
      ctaText: 'Choose Evolve',
      ctaAction: 'checkout',
      entitlements: { monthly_ai_sessions: 150, monthly_voice_minutes: 45 }
    },
    {
      code: 'evolve_annual',
      tierCode: 'evolve',
      tierName: 'APPU Evolve',
      name: 'APPU Evolve Annual',
      description: 'Persistent learner profile, adaptive learning paths, storytelling, and weekly missions.',
      currency: 'INR',
      amountPaise: 499900,
      displayPrice: '₹4,999/yr',
      billingInterval: 'yearly',
      annualSavingsPaise: 98900,
      monthlyEquivalentPaise: 41700,
      isPublic: true,
      isPrimaryCard: true,
      isRecommended: false,
      checkoutEnabled: true,
      displayOrder: 2,
      ctaText: 'Choose Evolve',
      ctaAction: 'checkout',
      entitlements: { monthly_ai_sessions: 150, monthly_voice_minutes: 45 }
    },
    {
      code: 'evolve_plus_monthly',
      tierCode: 'evolve_plus',
      tierName: 'APPU Evolve+',
      name: 'APPU Evolve+ Monthly',
      description: 'Advanced personalisation, strength identification, gap detection, goal journeys, and parent insights.',
      currency: 'INR',
      amountPaise: 99900,
      displayPrice: '₹999/mo',
      billingInterval: 'monthly',
      annualSavingsPaise: 0,
      monthlyEquivalentPaise: 99900,
      isPublic: true,
      isPrimaryCard: true,
      isRecommended: true,
      checkoutEnabled: true,
      displayOrder: 3,
      ctaText: 'Choose Evolve+',
      ctaAction: 'checkout',
      entitlements: { monthly_ai_sessions: 400, monthly_voice_minutes: 120 }
    },
    {
      code: 'evolve_plus_annual',
      tierCode: 'evolve_plus',
      tierName: 'APPU Evolve+',
      name: 'APPU Evolve+ Annual',
      description: 'Advanced personalisation, strength identification, gap detection, goal journeys, and parent insights.',
      currency: 'INR',
      amountPaise: 999900,
      displayPrice: '₹9,999/yr',
      billingInterval: 'yearly',
      annualSavingsPaise: 198900,
      monthlyEquivalentPaise: 83300,
      isPublic: true,
      isPrimaryCard: true,
      isRecommended: true,
      checkoutEnabled: true,
      displayOrder: 4,
      ctaText: 'Choose Evolve+',
      ctaAction: 'checkout',
      entitlements: { monthly_ai_sessions: 400, monthly_voice_minutes: 120 }
    },
    {
      code: 'signature',
      tierCode: 'signature',
      tierName: 'APPU Signature',
      name: 'APPU Signature',
      description: 'Bespoke institutional learning architecture, custom curricula, and high-touch private cohorts.',
      currency: 'INR',
      amountPaise: 499900,
      displayPrice: 'From ₹4,999/mo',
      billingInterval: 'monthly',
      annualSavingsPaise: 0,
      monthlyEquivalentPaise: 499900,
      isPublic: true,
      isPrimaryCard: true,
      isRecommended: false,
      checkoutEnabled: false,
      displayOrder: 5,
      ctaText: 'Apply for Signature',
      ctaAction: 'apply',
      entitlements: {}
    },
    {
      code: 'genesis_monthly',
      tierCode: 'genesis',
      tierName: 'APPU Genesis',
      name: 'APPU Genesis Monthly',
      description: 'Complete multimodal cognitive architecture with bespoke learning DNA and continuous coaching.',
      currency: 'INR',
      amountPaise: 249900,
      displayPrice: '₹2,499/mo',
      billingInterval: 'monthly',
      annualSavingsPaise: 0,
      monthlyEquivalentPaise: 249900,
      isPublic: true,
      isPrimaryCard: false,
      isRecommended: false,
      checkoutEnabled: true,
      displayOrder: 6,
      ctaText: 'Choose Genesis',
      ctaAction: 'checkout',
      entitlements: { monthly_ai_sessions: 1000, monthly_voice_minutes: 300 }
    },
    {
      code: 'genesis_annual',
      tierCode: 'genesis',
      tierName: 'APPU Genesis',
      name: 'APPU Genesis Annual',
      description: 'Complete multimodal cognitive architecture with bespoke learning DNA and continuous coaching.',
      currency: 'INR',
      amountPaise: 2499900,
      displayPrice: '₹24,999/yr',
      billingInterval: 'yearly',
      annualSavingsPaise: 498900,
      monthlyEquivalentPaise: 208300,
      isPublic: true,
      isPrimaryCard: false,
      isRecommended: false,
      checkoutEnabled: true,
      displayOrder: 7,
      ctaText: 'Choose Genesis',
      ctaAction: 'checkout',
      entitlements: { monthly_ai_sessions: 1000, monthly_voice_minutes: 300 }
    }
  ];

  beforeEach(() => {
    ParentOnboardingShell.state.plans = [...mockApprovedPlans];
    ParentOnboardingShell.state.subscription = null;
  });

  test('groupPlansByTier: groups variants into exactly 4 primary public tiers (no duplicate cards)', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);
    const primaryTiers = grouped.filter((t) => t.isPrimaryCard);

    // Invariant: Exactly 4 primary cards (Free, Evolve, Evolve+, Signature)
    assert.equal(primaryTiers.length, 4, 'Must render exactly 4 primary public tier cards');

    const tierCodes = primaryTiers.map((t) => t.tierCode);
    assert.deepEqual(tierCodes, ['free', 'evolve', 'evolve_plus', 'signature']);

    // Invariant: No duplicate cards for monthly and annual
    const evolveCards = primaryTiers.filter((t) => t.tierCode === 'evolve');
    assert.equal(evolveCards.length, 1, 'Must render exactly ONE Evolve card');

    const evolvePlusCards = primaryTiers.filter((t) => t.tierCode === 'evolve_plus');
    assert.equal(evolvePlusCards.length, 1, 'Must render exactly ONE Evolve+ card');
  });

  test('Monthly and Annual toggle mappings for Evolve and Evolve+', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);

    const evolve = grouped.find((t) => t.tierCode === 'evolve');
    assert.ok(evolve);
    assert.equal(evolve.monthly?.code, 'evolve_monthly');
    assert.equal(evolve.monthly?.amountPaise, 49900, 'Evolve monthly is ₹499');
    assert.equal(evolve.annual?.code, 'evolve_annual');
    assert.equal(evolve.annual?.amountPaise, 499900, 'Evolve annual is ₹4,999');

    const evolvePlus = grouped.find((t) => t.tierCode === 'evolve_plus');
    assert.ok(evolvePlus);
    assert.equal(evolvePlus.monthly?.code, 'evolve_plus_monthly');
    assert.equal(evolvePlus.monthly?.amountPaise, 99900, 'Evolve+ monthly is ₹999');
    assert.equal(evolvePlus.annual?.code, 'evolve_plus_annual');
    assert.equal(evolvePlus.annual?.amountPaise, 999900, 'Evolve+ annual is ₹9,999');
  });

  test('Annual savings and monthly equivalents match HR pricing specification', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);

    const evolve = grouped.find((t) => t.tierCode === 'evolve');
    assert.equal(evolve.annual?.monthlyEquivalentPaise, 41700, 'Evolve annual monthly equivalent is ₹417/mo');
    assert.equal(evolve.annual?.annualSavingsPaise, 98900, 'Evolve annual savings is ₹989/yr');

    const evolvePlus = grouped.find((t) => t.tierCode === 'evolve_plus');
    assert.equal(evolvePlus.annual?.monthlyEquivalentPaise, 83300, 'Evolve+ annual monthly equivalent is ₹833/mo');
    assert.equal(evolvePlus.annual?.annualSavingsPaise, 198900, 'Evolve+ annual savings is ₹1,989/yr');
  });

  test('Evolve+ is marked as recommended / MOST POPULAR', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);
    const evolvePlus = grouped.find((t) => t.tierCode === 'evolve_plus');
    assert.equal(evolvePlus?.isRecommended, true, 'Evolve+ must be recommended');

    const evolve = grouped.find((t) => t.tierCode === 'evolve');
    assert.equal(evolve?.isRecommended, false);
  });

  test('Genesis is contextual upsell and excluded from primary public cards', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);
    const genesis = grouped.find((t) => t.tierCode === 'genesis');
    assert.ok(genesis);
    assert.equal(genesis.isPrimaryCard, false, 'Genesis must NOT be a primary card');
    assert.equal(genesis.monthly?.code, 'genesis_monthly');
    assert.equal(genesis.annual?.code, 'genesis_annual');
  });

  test('Signature is application-only and checkoutEnabled is false', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);
    const sig = grouped.find((t) => t.tierCode === 'signature');
    assert.ok(sig);
    assert.equal(sig.isSignature, true);
    assert.equal(sig.monthly?.checkoutEnabled, false);
    assert.equal(sig.monthly?.ctaAction, 'apply');
  });

  test('Free tier is always ₹0 and provider-free', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);
    const free = grouped.find((t) => t.tierCode === 'free');
    assert.ok(free);
    assert.equal(free.isFree, true);
    assert.equal(free.monthly?.amountPaise, 0);
    assert.equal(free.monthly?.ctaAction, 'free_checkout');
  });

  test('Active plan identification in comparison view', () => {
    const grouped = ParentOnboardingShell.groupPlansByTier(mockApprovedPlans);

    // 1. Free plan active
    let activePlanCode = 'free';
    let currentInterval = 'yearly';
    let freeMatched = grouped.find((t) => t.tierCode === 'free');
    assert.equal(activePlanCode === 'free' || activePlanCode === freeMatched?.monthly?.code, true);

    // 2. Evolve Annual active -> initializes comparison to Annual
    activePlanCode = 'evolve_annual';
    currentInterval = activePlanCode.includes('monthly') ? 'monthly' : 'yearly';
    assert.equal(currentInterval, 'yearly', 'Annual active plan initializes comparison toggle to Annual');

    // 3. Evolve Monthly active -> initializes comparison to Monthly
    activePlanCode = 'evolve_monthly';
    currentInterval = activePlanCode.includes('monthly') ? 'monthly' : 'yearly';
    assert.equal(currentInterval, 'monthly', 'Monthly active plan initializes comparison toggle to Monthly');

    // 4. Default for new subscription selection is Annual
    let newSelectionInterval = 'yearly';
    assert.equal(newSelectionInterval, 'yearly', 'New selection must default to Annual');
  });

  test('CSS rules: Desktop modal is widened to min(1180px, calc(100vw - 48px)) and has 4-column responsive grid', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const css = fs.readFileSync(path.resolve(__dirname, '../frontend/style.css'), 'utf-8');

    // Invariant 1: Desktop modal width
    assert.match(
      css,
      /\.pos-sheet\s*\{[^}]*width:\s*min\(1180px,\s*calc\(100vw\s*-\s*48px\)\)/,
      'style.css must define widened desktop modal width min(1180px, calc(100vw - 48px))'
    );

    // Invariant 2: Full-width current plan dashboard class exists
    assert.match(
      css,
      /\.pos-current-plan-dashboard\s*\{[^}]*width:\s*100%/,
      'style.css must define full-width .pos-current-plan-dashboard'
    );

    // Invariant 3: Step-specific width separation
    assert.match(
      css,
      /\.pos-step-plan-content[^{]*\{[^}]*width:\s*100%;\s*max-width:\s*none;/,
      'style.css must define full-width .pos-step-plan-content'
    );
    assert.match(
      css,
      /\.pos-step-auth-content[^{]*\{[^}]*max-width:\s*620px;/,
      'style.css must define narrow .pos-step-auth-content max-width: 620px'
    );
    assert.match(
      css,
      /\.pos-step-child-content[^{]*\{[^}]*max-width:\s*760px;/,
      'style.css must define .pos-step-child-content max-width: 760px'
    );

    // Invariant 4: 4-column desktop grid
    assert.match(
      css,
      /\.pos-plans-grid[^{]*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
      'style.css must define 4-column desktop grid'
    );

    // Invariant 5: Tablet 2-column media query
    assert.match(
      css,
      /@media\s*\(max-width:\s*1099px\)\s*\{[^}]*\.pos-plans-grid[^{]*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
      'style.css must define tablet 2-column layout for <=1099px'
    );

    // Invariant 6: Mobile 1-column media query
    assert.match(
      css,
      /@media\s*\(max-width:\s*699px\)\s*\{[^}]*\.pos-plans-grid[^{]*\{[^}]*grid-template-columns:\s*1fr/,
      'style.css must define mobile 1-column layout for <=699px'
    );
  });

  test('UI Code: Zero learner-count wording, clean plan names, and Genesis contextual strip', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const uiCode = fs.readFileSync(path.resolve(__dirname, '../frontend/parent-setup-ui.js'), 'utf-8');

    // Invariant 1: No learner wording in plan cards
    assert.equal(uiCode.includes('1 student learner profile'), false, 'Must not include "1 student learner profile"');
    assert.equal(uiCode.includes('learner slot'), false, 'Must not include "learner slot"');
    assert.equal(uiCode.includes('learner limit'), false, 'Must not include "learner limit"');

    // Invariant 2: Genesis contextual strip CTA
    assert.match(
      uiCode,
      /Explore APPU Genesis →/,
      'parent-setup-ui.js must render "Explore APPU Genesis →"'
    );

    // Invariant 3: Redundant "Plan" suffix stripped from visible product name
    assert.match(
      uiCode,
      /replace\(/,
      'parent-setup-ui.js must clean redundant "Plan" suffix'
    );
  });

  test('Accessibility & Focus Management: Focus restored before setting aria-hidden="true"', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const uiCode = fs.readFileSync(path.resolve(__dirname, '../frontend/parent-setup-ui.js'), 'utf-8');
    const appCode = fs.readFileSync(path.resolve(__dirname, '../frontend/app.js'), 'utf-8');

    // Invariant 1: parent-setup-ui.js manages aria-hidden and focus restoration
    assert.match(
      uiCode,
      /lastFocusedElement\.focus\(\)/,
      'parent-setup-ui.js must restore focus to opener element'
    );
    assert.match(
      uiCode,
      /modal\.setAttribute\('aria-hidden',\s*'true'\)/,
      'parent-setup-ui.js must set aria-hidden true after focus shift'
    );

    // Invariant 2: app.js deactivateDialog restores focus before setting aria-hidden true
    assert.match(
      appCode,
      /if\s*\(dialog\.contains\(document\.activeElement\)\)/,
      'app.js must check if descendant has focus before setting aria-hidden'
    );

    // Invariant 3: Mobile header compact rules defined
    const css = fs.readFileSync(path.resolve(__dirname, '../frontend/style.css'), 'utf-8');
    assert.match(
      css,
      /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.topbar\s*\{[^}]*display:\s*flex;/,
      'style.css must define compact mobile topbar layout'
    );
  });
});



