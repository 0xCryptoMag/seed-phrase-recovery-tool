import type { Chain, RecoverArgs, PartialMnemonic } from './types';

import { isAddress } from 'viem';
import * as chains from 'viem/chains';
import { address, networks } from 'bitcoinjs-lib';
import { wordlists } from 'bip39';
import {
	createPartialWithCandidates,
	createCombinationsGenerator,
	createPossibleAddressesAndCombinations
} from './create';
import { queryAddressBalances } from './query';
import { getUpperBound } from './helpers';

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
export async function recover<C extends Chain>(args: RecoverArgs<C>) {
	const { partialMnemonic, repeatingWords, publicKey, chain } = args;

	console.log('Beginning recovery...');

	const partialWithCandidates = createPartialWithCandidates(partialMnemonic);
	console.log(
		`Generating combinations of candidates with repeating words set to ${String(
			repeatingWords
		).toUpperCase()}`
	);

	const upperBound = getUpperBound(
		partialWithCandidates,
		repeatingWords ?? true
	);
	console.log(`Total possible combinations calculated: ${upperBound}`);

	let count = 0n;
	for (const combinationsChunk of createCombinationsGenerator(
		partialWithCandidates,
		repeatingWords,
		1000
	)) {
		console.log(
			`Processing chunk of ${combinationsChunk.length} combinations...`
		);

		const { addressChunks, combinationChunks } =
			createPossibleAddressesAndCombinations(
				partialWithCandidates,
				combinationsChunk,
				chain
			);

		if (publicKey) {
			const matchingIndex = addressChunks.findIndex((address) => {
				if ('btc' in address) {
					return address.btc === publicKey;
				} else {
					return address.eth === publicKey;
				}
			});

			if (matchingIndex !== -1) {
				return {
					possibleAddresses: [addressChunks[matchingIndex]],
					possibleCombinations: [combinationChunks[matchingIndex]]
				};
			}
		}

		if ('queryBalances' in args && args.queryBalances) {
			const queryResult = await queryAddressBalances(
				addressChunks,
				combinationChunks,
				chain,
				count,
				upperBound
			);

			if (queryResult.loadedWalletAddresses.length > 0) {
				return {
					possibleAddresses: queryResult.loadedWalletAddresses,
					possibleCombinations: queryResult.loadedWalletCombinations,
					queryResult
				};
			}
		}

		count += 1000n;
	}

	console.error('No matches were found 🥺🥺');
}

if (require.main === module) {
	import('dotenv/config').then(() => {
		const mnemonicString = process.env.MNEMONIC || '';
		const repeatingWords = process.env.REPEATING_WORDS !== 'false';
		const chain = (process.env.CHAIN || undefined) as
			| keyof typeof chains
			| 'bitcoin';
		const publicKey = process.env.PUBLIC_KEY || undefined;
		const queryBalances = process.env.CHECK_BALANCES !== 'false';

		if (!/^(?:[A-Za-z]+|\*)(?: (?:[A-Za-z]+|\*)){11,}$/.test(mnemonicString)) {
			throw new Error(
				'Invalid mnemonic. Must be 12 or more words, ' +
					'with each word being composed of letters or one *'
			);
		}

		if (!chain || !Object.keys(chains).includes(chain)) {
			throw new Error(
				'Chain must be provided and must be a valid chain. ' +
					'If ethereum, use "mainnet"'
			);
		}

		if (!publicKey && !queryBalances) {
			throw new Error(
				'If queryBalances is false or not provided, publicKey must be provided'
			);
		}

		// Validating the btc address into a bech32 address, this is the most
		// likely standard used by blockstream's JADE wallet
		if (publicKey) {
			const isEth = isAddress(publicKey);
			let isBtc;
			try {
				const { data, version, prefix } = address.fromBech32(publicKey);
				const hrp = networks.bitcoin.bech32;
				const len = data.length;
				isBtc = prefix === hrp && version === 0 && (len === 20 || len === 32);
			} catch {
				isBtc = false;
			}
			if (!isEth && !isBtc) {
				throw new Error(
					'Invalid public key. Must be a valid EVM or BTC address'
				);
			}
		}

		const partialMnemonic: PartialMnemonic = mnemonicString
			.split(' ')
			.map((word) => (word === '*' ? undefined : word));

		const checkMnemonic = partialMnemonic.map((w) => {
			if (w === undefined) {
				return undefined;
			} else if (
				wordlists.english.filter((b) => b.startsWith(w)).length === 0
			) {
				return w;
			} else {
				return undefined;
			}
		});

		if (checkMnemonic.some((w) => w !== undefined)) {
			throw new Error(
				'Invalid mnemonic. Must be 12 or more words,' +
					'with each word being composed of letters or one *' +
					`\nInvalid words: ${checkMnemonic
						.filter((w) => w !== undefined)
						.join(', ')}`
			);
		}

		if (queryBalances) {
			recover({
				partialMnemonic,
				repeatingWords,
				chain,
				publicKey,
				queryBalances
			}).then((result) => {
				console.log('🥳🥳🥳🥳', JSON.stringify(result));
			});
		} else {
			recover({
				partialMnemonic,
				repeatingWords,
				publicKey: publicKey!,
				queryBalances,
				chain
			}).then((result) => {
				console.log('🥳🥳🥳🥳', JSON.stringify(result));
			});
		}
	});
}
