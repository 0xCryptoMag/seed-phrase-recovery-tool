# Seed Phrase Recovery Tool - Parallel Version

A high-performance, parallelized tool for recovering Bitcoin and Ethereum seed phrases with missing or partial words. Built with TypeScript, Node.js worker threads, and optimized for handling billions of combinations efficiently.

## 🚀 Features

- **Parallel Processing**: Uses multiple worker threads for faster recovery
- **Progress Tracking**: Persistent progress tracking with resume capability
- **Memory Efficient**: Streaming approach prevents memory overflow
- **Multi-Chain Support**: Bitcoin and Ethereum address generation
- **Partial Word Support**: Handle truncated words (e.g., "ab" for "abandon")
- **Flexible Recovery**: Match against known addresses or query balances
- **Resume Capability**: Continue from where you left off after interruption

## 📦 Installation

```bash
npm install
npm run build
```

## 🎯 Usage

### Basic Recovery with CLI

```bash
# Recover Bitcoin wallet with 3 missing words
npm run parallel -- --mnemonic "abandon abandon abandon * abandon abandon abandon * abandon abandon abandon * abandon" --chain bitcoin --query-balances

# Recover Ethereum wallet with known address
npm run parallel -- --mnemonic "abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon" --chain mainnet --public-key 0x1234...

# Resume previous run
npm run parallel -- --mnemonic "..." --chain bitcoin --resume
```

### CLI Options

| Option              | Description                                      | Required |
| ------------------- | ------------------------------------------------ | -------- |
| `--mnemonic`        | Partial mnemonic with `*` for missing words      | ✅       |
| `--chain`           | Blockchain to check (`mainnet`, `bitcoin`, etc.) | ✅       |
| `--public-key`      | Address to match against                         | ❌       |
| `--query-balances`  | Query blockchain for balances                    | ❌       |
| `--repeating-words` | Allow repeating words in combinations            | ❌       |
| `--workers`         | Number of worker threads (default: 4)            | ❌       |
| `--chunk-size`      | Combinations per chunk (default: 1000)           | ❌       |
| `--resume`          | Resume from previous run                         | ❌       |
| `--help`            | Show help information                            | ❌       |

### Programmatic Usage

```typescript
import { recover } from './src/recover';

const result = await recover({
  partialMnemonic: ['abandon', 'abandon', 'abandon', undefined, 'abandon', ...],
  repeatingWords: false,
  chain: 'bitcoin',
  queryBalances: true
});
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
MNEMONIC="abandon abandon abandon * abandon abandon abandon * abandon abandon abandon * abandon"
CHAIN=bitcoin
PUBLIC_KEY=bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
CHECK_BALANCES=true
REPEATING_WORDS=false
```

### Performance Tuning

- **Workers**: Adjust based on CPU cores and memory
- **Chunk Size**: Balance memory usage vs. worker efficiency
- **Memory Limit**: Use `--max-old-space-size` for large combinations

## 📊 Progress Tracking

The tool automatically saves progress to `recovery-progress.json`:

```json
{
	"lastProcessedIndex": "1000000",
	"totalCombinations": "1000000000",
	"startTime": "2024-01-01T00:00:00.000Z",
	"lastUpdateTime": "2024-01-01T01:00:00.000Z",
	"chunksProcessed": 1000,
	"status": "running"
}
```

### Resume Capability

If the process is interrupted, you can resume:

```bash
npm run parallel -- --mnemonic "..." --chain bitcoin --resume
```

## 🏗️ Architecture

### Components

1. **ParallelManager**: Coordinates worker threads and chunk distribution
2. **Worker Threads**: Process combinations and check balances in parallel
3. **ProgressTracker**: Persistent progress tracking with file I/O
4. **Combination Generator**: Memory-efficient streaming of combinations
5. **Address Generator**: Creates Bitcoin/Ethereum addresses from mnemonics

### Data Flow

```
Mnemonic Input → Candidate Generation → Parallel Processing → Result Collection
                     ↓
              Progress Tracking ← Worker Threads ← Chunk Distribution
```

## ⚡ Performance

### Benchmarks

- **Sequential**: ~1000 combinations/second
- **Parallel (4 workers)**: ~3000-4000 combinations/second
- **Memory Usage**: Constant (streaming approach)
- **Scalability**: Linear with worker count

### Optimization Tips

1. **Use appropriate worker count** (typically CPU core count)
2. **Balance chunk size** (larger = more memory, smaller = more overhead)
3. **Enable early termination** with `--public-key` when possible
4. **Use resume capability** for long-running recoveries

## 🚨 Error Handling

The tool handles various error scenarios:

- **Network failures**: Automatic retry and continuation
- **Memory issues**: Streaming prevents overflow
- **Interruptions**: Graceful shutdown with progress preservation
- **Invalid inputs**: Comprehensive validation with helpful error messages

## 🔒 Security

- **No private keys**: Only generates addresses for validation
- **Local processing**: All sensitive operations happen locally
- **Secure validation**: Uses established cryptographic libraries

## 📝 Examples

### Example 1: Bitcoin Recovery (3 missing words)

```bash
npm run parallel -- \
  --mnemonic "abandon abandon abandon * abandon abandon abandon * abandon abandon abandon * abandon" \
  --chain bitcoin \
  --query-balances \
  --workers 4
```

### Example 2: Ethereum Recovery with Known Address

```bash
npm run parallel -- \
  --mnemonic "abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon" \
  --chain mainnet \
  --public-key 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 \
  --workers 8
```

### Example 3: Resume Interrupted Recovery

```bash
npm run parallel -- \
  --mnemonic "..." \
  --chain bitcoin \
  --resume \
  --workers 6
```

## 🐛 Troubleshooting

### Common Issues

1. **Memory errors**: Increase `--max-old-space-size` or reduce chunk size
2. **Worker crashes**: Check network connectivity and API rate limits
3. **Slow performance**: Adjust worker count and chunk size
4. **Progress not saving**: Check file permissions for progress file

### Debug Mode

Enable verbose logging by setting environment variable:

```bash
DEBUG=recovery npm run parallel -- ...
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

ISC License - see LICENSE file for details.

## ⚠️ Disclaimer

This tool is for educational and legitimate recovery purposes only. Always ensure you have legal access to the wallets you're attempting to recover. The authors are not responsible for any misuse of this software.
