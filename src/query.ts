import type { Address, PublicClient, Transport } from 'viem';
import type { QueryResult } from './types';

import { createPublicClient, http } from 'viem';
import * as chains from 'viem/chains';

/**
 * Query the balances of the possible addresses for the given chain
 * @param possibleAddresses - The possible addresses
 * @param possibleCombinations - The possible combinations
 * @param chain - The chain to query
 */
export async function queryAddressBalances(
	possibleAddresses: { ethereum: Address; bitcoin: string }[],
	possibleCombinations: string[][],
	chain: keyof typeof chains | 'bitcoin'
): Promise<QueryResult> {
	const balances: bigint[] = [];
	const loadedWalletAddresses: { ethereum: Address; bitcoin: string }[] = [];
	const loadedWalletCombinations: string[][] = [];

	for (let i = 0; i < possibleAddresses.length; i++) {
		const address = possibleAddresses[i];
		const combination = possibleCombinations[i];

		if (chain !== 'bitcoin') {
			const client = createPublicClient({
				chain: chains[chain],
				transport: http()
			});

			const balance = await checkEthBalance(address.ethereum, client);

			if (balance > 0n) {
				balances.push(balance);
				loadedWalletAddresses.push(address);
				loadedWalletCombinations.push(combination);
			}
		} else {
			const balance = await checkBtcBalance(address.bitcoin);

			if (balance > 0n) {
				balances.push(balance);
				loadedWalletAddresses.push(address);
				loadedWalletCombinations.push(combination);
			}
		}

		console.log(`Queryied ${i + 1} of ${possibleAddresses.length} addresses`);
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
export async function checkEthBalance(
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
export async function checkBtcBalance(address: string): Promise<bigint> {
	const res = await fetch(`https://blockstream.info/api/address/${address}`);
	if (!res.ok) return 0n;

	const data: any = await res.json();
	if (!data.chain_stats) return 0n;

	return BigInt(
		data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
	);
}
