import type { Address } from 'viem';

import { wordlists } from 'bip39';
import * as chains from 'viem/chains';
import {
	getPartialMnemonicWithMissingWords,
	getFullMnemonicFromCandidates,
	getMissingPositionsAndCandidates,
	getEthWalletAddresses,
	getBtcWalletAddress,
	getUpperBound
} from './helpers';

export type PartialMnemonic = (string | undefined)[];
export type PartialWithCandidates = (string | string[] | undefined)[];
export type Chain = keyof typeof chains | 'bitcoin';
export type PossibleAddress<C extends Chain> = C extends 'bitcoin'
	? { btc: string }
	: { eth: Address };

/**
 * Create a sparse array where missing words are undefined and partial words are
 * replaced arrays candidates that start with the partial word
 * @param partialMnemonic - A sparse array of words where the words can be
 * truncated to be interpreted as a partial word
 */
export function createPartialWithCandidates(
	partialMnemonic: PartialMnemonic
): PartialWithCandidates {
	const partialWithCandidates: PartialWithCandidates = [];

	for (let i = 0; i < partialMnemonic.length; i++) {
		const word = partialMnemonic[i];

		if (typeof word === 'string') {
			if (wordlists.english.includes(word)) {
				partialWithCandidates[i] = word;
			} else {
				const candidatesStartsWithWord = wordlists.english.filter((w) =>
					w.startsWith(word)
				);

				if (candidatesStartsWithWord.length === 0)
					partialWithCandidates[i] = undefined;
				if (candidatesStartsWithWord.length === 1)
					partialWithCandidates[i] = candidatesStartsWithWord[0];
				if (candidatesStartsWithWord.length > 1)
					partialWithCandidates[i] = candidatesStartsWithWord;
			}
		} else {
			partialWithCandidates[i] = undefined;
		}
	}

	console.log(
		`Generated candidates for ${
			partialWithCandidates.filter((w) => w === undefined).length
		} missing words, and ${
			partialWithCandidates.filter((w) => Array.isArray(w)).length
		} partially filled words`
	);

	return partialWithCandidates;
}

/**
 * A generator function that creates a limited number of combinations of the
 * candidates at a time to prevent memory overflow. Uses yield to dynamically
 * control chunk size and skip count for optimal performance.
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param repeatingWords - Whether to allow repeating words in the combinations
 */
export function* createCombinationsGenerator(
	partialWithCandidates: PartialWithCandidates,
	repeatingWords: boolean = false
): Generator<string[][], void, bigint> {
	const { missingPositions, candidateLists } = getMissingPositionsAndCandidates(
		partialWithCandidates
	);
	const wordList = wordlists.english;

	let combinations: string[][] = [];
	let chunkSize: bigint;

	function* permutationsGenerator(
		current: string[],
		depth: number
	): Generator<string[][], void, bigint> {
		if (depth === missingPositions.length) {
			combinations.push([...current]);

			if (combinations.length >= chunkSize) {
				const nextChunkSize = yield combinations;
				combinations = [];
				chunkSize = nextChunkSize;
			}
			return;
		}

		const candidates = candidateLists[depth] || wordList;

		for (const word of candidates) {
			if (!repeatingWords) {
				const testMnemonic = getPartialMnemonicWithMissingWords(
					partialWithCandidates,
					current,
					depth
				);
				if (testMnemonic.includes(word)) {
					continue;
				}
			}
			current[depth] = word;
			yield* permutationsGenerator(current, depth + 1);
		}
	}

	// We yield [[]] to get the skip count in the first next call. This allows
	// us to skip without parameterizing it then wastefully checking if the
	// skip count was passed after *every* iteration even after threshold passed
	const skipCount = yield [[]];
	chunkSize = skipCount;

	yield* permutationsGenerator(new Array(missingPositions.length), 0);
	if (combinations.length > 0) {
		yield combinations;
	}
}

/**
 * Calculate the exact combination at a specific index without generating all
 * previous ones. This is useful for resuming from a specific point
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param repeatingWords - Whether to allow repeating words in the combinations
 * @param targetIndex - The index of the combination to get
 */
export function getCombinationAtIndex(
	partialWithCandidates: PartialWithCandidates,
	repeatingWords: boolean = false,
	targetIndex: bigint
): string[] | null {
	const { missingPositions, candidateLists } = getMissingPositionsAndCandidates(
		partialWithCandidates
	);

	if (missingPositions.length === 0) return null;

	// Calculate total combinations for validation
	let totalCombinations = getUpperBound(partialWithCandidates, repeatingWords);

	if (targetIndex >= totalCombinations) return null;

	const result = new Array(missingPositions.length);
	let remainingIndex = targetIndex;

	// Calculate each position's value
	for (let i = 0; i < missingPositions.length; i++) {
		const candidates = candidateLists[i] || wordlists.english;
		const combinationsAfterThis = totalCombinations / BigInt(candidates.length);
		const candidateIndex = Number(remainingIndex / combinationsAfterThis);

		result[i] = candidates[candidateIndex];
		remainingIndex = remainingIndex % combinationsAfterThis;
		totalCombinations = combinationsAfterThis;
	}

	return result;
}

/**
 * Generates all possible addresses by using the partial with candidates and
 * combining it with the combinations of candidates. Not all permutations create
 * VALID mnemonic phrases, so this function finds all valid combinations and
 * returns them along with the addresses they create
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param combinationsOfCandidates - All the combinations of candidates
 */
export function createPossibleAddressesAndCombinations<C extends Chain>(
	partialWithCandidates: PartialWithCandidates,
	combinationsOfCandidates: string[][],
	chain: C
): {
	addressChunks: PossibleAddress<C>[];
	combinationChunks: string[][];
} {
	const addressChunks: PossibleAddress<C>[] = [];
	const combinationChunks: string[][] = [];

	for (const combination of combinationsOfCandidates) {
		try {
			const fullMnemonic = getFullMnemonicFromCandidates(
				partialWithCandidates,
				combination
			);
			const address =
				chain !== 'bitcoin'
					? getEthWalletAddresses(fullMnemonic)
					: getBtcWalletAddress(fullMnemonic);

			addressChunks.push(address as PossibleAddress<C>);
			combinationChunks.push(combination);
		} catch {
			continue;
		}
	}

	console.log(`Found ${addressChunks.length} possible valid addresses`);

	return {
		addressChunks,
		combinationChunks
	};
}
