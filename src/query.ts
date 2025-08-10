import type { Address, PublicClient, Transport } from 'viem';
import type { Chain, PossibleAddress, QueryResult } from './types';

import { createPublicClient, http } from 'viem';
import * as chains from 'viem/chains';

/**
 * Query the balances of the possible addresses for the given chain
 * @param possibleAddresses - The possible addresses
 * @param possibleCombinations - The possible combinations
 * @param chain - The chain to query
 */
export async function queryAddressBalances<C extends Chain>(
	possibleAddresses: PossibleAddress<C>[],
	possibleCombinations: string[][],
	chain: C,
	count: bigint,
	upperBound: bigint
): Promise<QueryResult<C>> {
	const balances: bigint[] = [];
	const loadedWalletAddresses: PossibleAddress<C>[] = [];
	const loadedWalletCombinations: string[][] = [];

	for (let i = 0; i < possibleAddresses.length; i++) {
		const address = possibleAddresses[i];
		const combination = possibleCombinations[i];

		if (chain !== 'bitcoin') {
			const client = createPublicClient({
				chain: chains[chain as keyof typeof chains],
				transport: http()
			});

			const balance = await queryEthBalance(
				(address as { eth: Address }).eth,
				client
			);

			if (balance > 0n) {
				balances.push(balance);
				loadedWalletAddresses.push(address);
				loadedWalletCombinations.push(combination);
			}
		} else {
			const balance = await queryBtcBalance((address as { btc: string }).btc);

			if (balance > 0n) {
				balances.push(balance);
				loadedWalletAddresses.push(address);
				loadedWalletCombinations.push(combination);
			}
		}

		console.log(`Queryied ${count++ + 1n} of ${upperBound} addresses`);
	}

	return {
		balances,
		loadedWalletAddresses,
		loadedWalletCombinations
	};
}

/**
 * Check the balance of an EVM address
 * @param address - The address to check
 * @param client - The client to use
 */
export async function queryEthBalance(
	address: Address,
	client: PublicClient<Transport, (typeof chains)[keyof typeof chains]>
): Promise<bigint> {
	try {
		return await client.getBalance({
			address: address
		});
	} catch (error) {
		return 0n;
	}
}

/**
 * Check the balance of a Bitcoin address
 * @param address - The address to check
 */
export async function queryBtcBalance(address: string): Promise<bigint> {
	const res = await fetch(`https://blockstream.info/api/address/${address}`);
	if (!res.ok) return 0n;

	const data: any = await res.json();
	if (!data.chain_stats) return 0n;

	return BigInt(
		data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
	);
}
