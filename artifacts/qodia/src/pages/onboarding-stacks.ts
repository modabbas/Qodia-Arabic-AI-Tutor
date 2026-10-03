import type { TechStack, SecondaryTechStack } from '@workspace/api-client-react';

export const onboardingStacks: TechStack[] = ['Django', 'Node.js', 'React', 'Flutter'];

export function secondaryStackOptions(primary: TechStack | '') {
  return onboardingStacks.filter(item => item !== primary);
}

export function secondaryAfterPrimaryChange(primary: TechStack | '', secondary: SecondaryTechStack | '') {
  return secondary === primary ? '' : secondary;
}