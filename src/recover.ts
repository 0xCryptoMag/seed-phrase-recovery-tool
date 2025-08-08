import type { Address } from 'viem';
import type { RecoverArgs, PartialMnemonic, RecoveryResult } from './types';

import * as chains from 'viem/chains';
import {
	createPartialWithCandidates,
	generateCombinationsOfCandidates,
	generatePossibleAddressesAndCombinations
} from './create';
import { queryAddressBalances } from './query';

/**
 * Recover the possible addresses and combinations of candidates for a partial
 * mnemonic. It is recommended to add a publicKey if known, and if not,
 * queryBalances should be set true to search for non-zero balances. Performing
 * queryies can take a really long time depending on the number of missing words
 * @param args - Always includes the partial mnemonic. Include a repeatingWords
 * boolean for seeds with repeating words (this will significantly increase
 * complexity and computation time). Include a publicKey (ethereum or bitcoin)
 * if known to match against the possible addresses output. Include a
 * queryBalances boolean to query balances for the possible addresses output. If
 * queryBalances is true, chain must be provided.
 */
export async function recover(args: RecoverArgs): Promise<RecoveryResult> {
	const { partialMnemonic, repeatingWords, publicKey, queryBalances, chain } =
		args;

	console.log('Generating candidates...');
	const partialWithCandidates = createPartialWithCandidates(partialMnemonic);

	console.log(
		`Generating combinations of candidates with repeating words set to ${String(
			repeatingWords
		).toUpperCase()}`
	);
	const combinationsOfCandidates = generateCombinationsOfCandidates(
		partialWithCandidates,
		repeatingWords
	);

	console.log('Filtering combinations of candidates for valid addresses');
	const { possibleAddresses, possibleCombinations } =
		generatePossibleAddressesAndCombinations(
			partialWithCandidates,
			combinationsOfCandidates
		);

	if (publicKey) {
		console.log('Public key was supplied, checking for matching address');
		const matchingAddressIndex = possibleAddresses.findIndex((address) => {
			if (!chain) {
				return address.bitcoin === publicKey || address.ethereum === publicKey;
			} else if (chain === 'bitcoin') {
				return address.bitcoin === publicKey;
			} else {
				return address.ethereum === publicKey;
			}
		});

		if (matchingAddressIndex !== -1) {
			return {
				possibleAddresses: [possibleAddresses[matchingAddressIndex]],
				possibleCombinations: [possibleCombinations[matchingAddressIndex]]
			};
		} else {
			console.warn(
				'Did not find an address that matched given public key.' +
					' Check that correct address was given'
			);
		}
	}

	if (queryBalances) {
		console.log('Querying balances for possible addresses');
		const queryResult = await queryAddressBalances(
			possibleAddresses,
			possibleCombinations,
			chain
		);

		if (queryResult.loadedWalletAddresses.length > 0) {
			console.log('Found addresses with balances');
			const crossTable = queryResult.loadedWalletAddresses.map(
				(address, idx) => ({
					Address: address,
					Combination: queryResult.loadedWalletCombinations[idx]
				})
			);
			console.table(crossTable);

			return {
				possibleAddresses: queryResult.loadedWalletAddresses,
				possibleCombinations: queryResult.loadedWalletCombinations,
				queryResult
			};
		} else {
			console.warn(
				'Did not find an address with balances that matched given public key.' +
					' Check that correct address was given'
			);
		}
	}

	return {
		possibleAddresses,
		possibleCombinations
	};
}

if (require.main === module) {
	import('dotenv/config').then(() => {
		const mnemonicString = process.env.MNEMONIC || '';
		const publicKey = (process.env.PUBLIC_KEY || undefined) as
			| Address
			| undefined;
		const chain = (process.env.CHAIN || undefined) as
			| keyof typeof chains
			| 'bitcoin'
			| undefined;
		const repeatingWords = process.env.REPEATING_WORDS !== 'false';
		const queryBalances = process.env.CHECK_BALANCES !== 'false';

		const partialMnemonic: PartialMnemonic = mnemonicString
			.split(' ')
			.map((word) => (word === '*' ? undefined : word));

		if (partialMnemonic.length < 12) {
			throw new Error('Partial mnemonic must be at least 12 words');
		}

		if (queryBalances && !chain) {
			throw new Error('Chain must be provided if queryBalances is true');
		}

		if (queryBalances) {
			recover({
				partialMnemonic,
				repeatingWords,
				publicKey,
				queryBalances,
				chain: chain!
			});
		} else {
			recover({
				partialMnemonic,
				repeatingWords,
				publicKey,
				queryBalances,
				chain
			});
		}
	});
}
