import type { Address } from 'viem';
import type { PartialMnemonic, PartialWithCandidates } from './types';

import { wordlists } from 'bip39';
import {
	createPartialMnemonicWithMissingWords,
	createFullMnemonicFromCandidates,
	generateWalletAddresses
} from './helpers';

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
 * Takes a partial mnemonic and obtains an array of string arrays where the
 * elements of the outer array are a permutation of just the candidates for the
 * missing words (not the whole seed phrase)
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param repeatingWords - Whether to allow repeating words
 */
export function generateCombinationsOfCandidates(
	partialWithCandidates: PartialWithCandidates,
	repeatingWords: boolean = false
): string[][] {
	const wordList = wordlists.english;

	const candidateLists: (string[] | undefined)[] = [];

	partialWithCandidates.forEach((word, index) => {
		if (typeof word === 'string') {
			return;
		} else if (Array.isArray(word)) {
			candidateLists.push(word);
		} else {
			candidateLists.push(undefined);
		}
	});

	const combinationsOfCandidates: string[][] = [];

	(function generatePermutations(current: string[], depth: number) {
		if (depth === candidateLists.length) {
			combinationsOfCandidates.push([...current]);
			return;
		}

		const candidates = candidateLists[depth] || wordList;

		for (const candidate of candidates) {
			if (!repeatingWords) {
				const testMnemonic = createPartialMnemonicWithMissingWords(
					partialWithCandidates,
					current,
					depth
				);
				if (testMnemonic.includes(candidate)) continue;
			}
			current[depth] = candidate;
			generatePermutations(current, depth + 1);
		}
	})(new Array(candidateLists.length), 0);

	console.log(
		`Generated ${combinationsOfCandidates.length} combinations of candidates`
	);

	return combinationsOfCandidates;
}

/**
 * Generates all possible addresses by using the partial with candidates and
 * combining it with the combinations of candidates. Not all permutations create
 * VALID mnemonic phrases, so this function finds all valid combinations and
 * returns them along with the addresses they create
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param combinationsOfCandidates - All the combinations of candidates
 */
export function generatePossibleAddressesAndCombinations(
	partialWithCandidates: PartialWithCandidates,
	combinationsOfCandidates: string[][]
): {
	possibleAddresses: { ethereum: Address; bitcoin: string }[];
	possibleCombinations: string[][];
} {
	const possibleAddresses: { ethereum: Address; bitcoin: string }[] = [];
	const possibleCombinations: string[][] = [];

	for (const combination of combinationsOfCandidates) {
		try {
			const fullMnemonic = createFullMnemonicFromCandidates(
				partialWithCandidates,
				combination
			);
			const address = generateWalletAddresses(fullMnemonic);

			possibleAddresses.push(address);
			possibleCombinations.push(combination);
		} catch {
			continue;
		}
	}

	console.log(`Found ${possibleAddresses.length} possible valid addresses`);

	return {
		possibleAddresses,
		possibleCombinations
	};
}
