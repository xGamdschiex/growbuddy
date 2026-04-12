/**
 * AutoPot Athena v3 - Mix Process Logic
 * Wraps nutrients.ts calculation into a step-by-step mix process.
 * Used by the MIX screen to display swipeable cards.
 */

import type { CalcResult, MixStep } from './nutrients';

export type MixStepStatus = 'pending' | 'active' | 'done';

export interface MixStepUI extends MixStep {
  status: MixStepStatus;
  icon: string;
}

/** Fallback-Icons für generische Labels */
const FALLBACK_ICONS: Record<string, string> = {
  'Wasser befuellen': 'droplet',
  'Mono Mg': 'flask',
  'Athena CalMag': 'beaker',
  'CANNA CalMag': 'beaker',
  'BioBizz CalMag': 'beaker',
  'Cleanse': 'sparkles',
  'pH einstellen': 'gauge',
  'EC kontrollieren': 'zap',
};

/** Convert CalcResult mix_steps into UI-ready steps with status tracking */
export function buildMixUI(result: CalcResult, currentStep: number): MixStepUI[] {
  // Produkt-Icons aus FeedLine extrahieren
  const productIcons: Record<string, string> = {};
  if (result.feedline) {
    for (const p of result.feedline.produkte) {
      // Match auf Label-Pattern: "ProductName einwiegen" oder "ProductName abmessen"
      productIcons[`${p.name} einwiegen`] = p.icon;
      productIcons[`${p.name} abmessen`] = p.icon;
    }
  }

  return result.mix_steps.map((step, i) => ({
    ...step,
    status: i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending',
    icon: productIcons[step.label] ?? FALLBACK_ICONS[step.label] ?? 'circle',
  }));
}

/** Get total step count */
export function totalSteps(result: CalcResult): number {
  return result.mix_steps.length;
}
