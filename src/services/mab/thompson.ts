import { betaSample } from '../../utils/math'

export interface ArmState {
	alpha: number // successes + 1
	beta: number  // failures + 1
}

/** Select the arm index with the highest Thompson sample */
export function selectArm(arms: ArmState[]): number {
	let bestIdx = 0
	let bestSample = -1

	for (let i = 0; i < arms.length; i++) {
		const sample = betaSample(arms[i].alpha, arms[i].beta)
		if (sample > bestSample) {
			bestSample = sample
			bestIdx = i
		}
	}

	return bestIdx
}

/** Update arm state after observing a reward (success/failure) */
export function updateArm(arm: ArmState, success: boolean): ArmState {
	return {
		alpha: arm.alpha + (success ? 1 : 0),
		beta: arm.beta + (success ? 0 : 1),
	}
}
