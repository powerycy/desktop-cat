import type { GuardianConfig, GuardianGenerationInput } from '../types/guardian'
import { generateGuardianMock } from './geminiMockService'

export async function generateGuardian(input: GuardianGenerationInput): Promise<GuardianConfig> {
  return generateGuardianMock(input)
}
