import type { PetState } from '../stores/petStore'

export function isGrumpyCatSet(spriteSetName: string): boolean {
  return spriteSetName === '暴躁喵' || spriteSetName.toLowerCase() === 'grumpy cat'
}

export function getPetSpriteClasses(
  spriteSetName: string,
  _currentState: PetState,
  facingRight: boolean,
): string[] {
  const classes = ['pet-sprite']
  if (!facingRight) classes.push('flip')
  if (isGrumpyCatSet(spriteSetName)) classes.push('grumpy-desktop')
  return classes
}
