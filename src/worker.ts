import type {
	Chain,
	PartialWithCandidates,
	PossibleAddress,
	QueryResult
} from './types';

import { createPossibleAddressesAndCombinations } from './create';
import { queryAddressBalances } from './query';
import { parentPort } from 'worker_threads';

export type WorkerMessage = {
	type: 'process_chunk';
	chunkId: number;
	partialWithCandidates: PartialWithCandidates;
	combinationsChunk: string[][];
	chain: Chain;
	publicKey?: string;
	queryBalances: boolean;
	startIndex: bigint;
	totalCombinations: bigint;
};

export type WorkerResult = {
	chunkId: number;
	type: 'chunk_complete' | 'match_found' | 'loaded_wallet_found';
	addresses: PossibleAddress<Chain>[];
	combinations: string[][];
	queryResult?: QueryResult<Chain>;
	startIndex: bigint;
	endIndex: bigint;
};

if (parentPort) {
	parentPort.on('message', async (message: WorkerMessage) => {
		try {
			const {
				chunkId,
				partialWithCandidates,
				combinationsChunk,
				chain,
				publicKey,
				queryBalances,
				startIndex,
				totalCombinations
			} = message;

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
					const result: WorkerResult = {
						chunkId,
						type: 'match_found',
						addresses: [addressChunks[matchingIndex]],
						combinations: [combinationChunks[matchingIndex]],
						startIndex,
						endIndex: startIndex + BigInt(combinationsChunk.length)
					};
					parentPort!.postMessage(result);
					return;
				}
			}

			if (queryBalances) {
				const queryResult = await queryAddressBalances(
					addressChunks,
					combinationChunks,
					chain,
					startIndex,
					totalCombinations
				);

				if (queryResult.loadedWalletAddresses.length > 0) {
					const result: WorkerResult = {
						chunkId,
						type: 'loaded_wallet_found',
						addresses: queryResult.loadedWalletAddresses,
						combinations: queryResult.loadedWalletCombinations,
						queryResult,
						startIndex,
						endIndex: startIndex + BigInt(combinationsChunk.length)
					};
					parentPort!.postMessage(result);
					return;
				}
			}

			const result: WorkerResult = {
				chunkId,
				type: 'chunk_complete',
				addresses: addressChunks,
				combinations: combinationChunks,
				startIndex,
				endIndex: startIndex + BigInt(combinationsChunk.length)
			};
			parentPort!.postMessage(result);
		} catch (error) {
			parentPort!.postMessage({
				chunkId: message.chunkId,
				type: 'error',
				error: error instanceof Error ? error.message : String(error),
				startIndex: message.startIndex,
				endIndex: message.startIndex + BigInt(message.combinationsChunk.length)
			});
		}
	});
}
