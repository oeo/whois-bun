# whois-bun

A high-performance domain availability checker built with Bun. Features pattern-based domain searching, parallel whois lookups, and smart caching. Zero non-native dependencies, using a custom native bitmap implementation for efficient history management.

## Features

- Pattern-based domain searching
- Parallel whois lookups
- Smart caching of checked domains
- Support for multiple TLDs
- Progress tracking and resumable checks
- Native bitmap-based history tracking (zero dependencies)
- Pure TypeScript implementation

## Installation

```bash
# Install globally
bun install -g whois-bun

# Or run directly from the repository
git clone https://github.com/oeo/whois-bun.git
cd whois-bun
bun install
```

## Usage

```bash
whois-bun [options] [pattern...]
```

### Pattern Syntax

- `c` - any consonant (bcdfghjklmnpqrstvwxz)
- `v` - any vowel (aeiou)
- `n` - any number (0-9)
- `l` - any letter (a-z)
- `_` - any valid domain character (letters, numbers, hyphen)
- `-` - literal hyphen
- Any other character or uppercase letter - literal match

### Examples

```bash
# Check all 2-letter domains with .com extension
whois-bun --pattern "ll" --extensions=.com

# Check domains with specific pattern
whois-bun --pattern "HELLO__" --extensions=.com,.net

# Check multiple patterns from a file
whois-bun --file patterns.txt

# Pipe patterns from another command
echo "example" | whois-bun --extensions=.com

# Run 5 parallel checks with 200ms delay
whois-bun --pattern "ccvv" --extensions=.com --parallel 5 --delayms 200
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--pattern PATTERN` | Domain name pattern to check | - |
| `--extensions LIST` | Comma-separated list of extensions | .com |
| `--file PATH` | Read patterns from file | - |
| `--file-history PATH` | Path to history file | ./domain-check-history.bitmap |
| `--file-available PATH` | Path to available domains output | ./available-domains.txt |
| `--parallel N` | Number of parallel whois lookups | 2 |
| `--delayms N` | Delay between checks in milliseconds | 100 |
| `--help, -h` | Display help and exit | - |
| `--version, -v` | Output version information and exit | - |

### Pattern File Format

```
# Comments start with #
pattern ; extensions=.com,.net     # Inline comments supported
ccvv                              # Simple pattern
test-_ ; extensions=.dev,.com     # Multiple extensions
```

## Examples in Detail

### Basic Pattern Search
```bash
# Find all 4-letter domains with .com extension
whois-bun --pattern "llll" --extensions=.com

# Find domains with consonant-vowel-consonant pattern
whois-bun --pattern "cvc" --extensions=.com
```

### Multiple Extensions
```bash
# Check availability across multiple TLDs
whois-bun --pattern "test-l" --extensions=.com,.net,.org

# Check specific pattern on new TLDs
whois-bun --pattern "startup" --extensions=.io,.ai,.app
```

### Using Pattern Files
```bash
# Create a pattern file (patterns.txt):
# HELLOccv
# techN ; extensions=.io,.ai
# LITERAL___ ; extensions=.com,.net
# startup-l

# Check all patterns
whois-bun --file patterns.txt
```

### Advanced Usage
```bash
# Run faster checks with more parallel processes
whois-bun --pattern "lll" --parallel 5 --delayms 50

# Save results to custom location
whois-bun --pattern "cc-cc" --file-available custom-results.txt

# Use custom history file
whois-bun --pattern "test-l" --file-history custom-history.bitmap
```

## Performance Tips

1. **Parallel Processing**: Increase `--parallel` for faster checks, but be mindful of rate limits
2. **Delay Tuning**: Adjust `--delayms` based on your connection and target servers
3. **Pattern Efficiency**: More specific patterns = faster searches
4. **History Management**: Use custom history files for different search sessions

## Error Handling

- Invalid patterns are reported with specific error messages
- Network errors are handled gracefully with retries
- Progress is saved automatically and can be resumed
- Ctrl+C handling with clean shutdown

## Test Coverage

The project includes comprehensive tests covering all major functionality:

```bash
bitmap.test.ts: (7 tests)
✓ Bitmap operations
  - Initialization
  - Add and test operations
  - Serialization/deserialization
  - Collision handling
  - Debug information
  - Boundary conditions
  - Hash distribution

index.test.ts: (18 tests)
✓ Pattern Parsing
  - Literal text handling
  - Wildcard handling
  - Special characters
  - Mixed patterns

✓ Pattern Validation
  - Empty patterns
  - Invalid characters
  - Hyphen rules
  - Valid patterns

✓ Extension Validation
  - Format validation
  - Multiple extensions

✓ Domain Generation
  - Letter combinations
  - Hyphen handling
  - Wildcard expansion
  - Invalid combination skipping

✓ Pattern Analysis
  - Single extension analysis
  - Multiple extension analysis

✓ Pattern File Processing
  - Pattern file parsing
  - Comment handling

Summary:
- Total Tests: 25
- Passing: 25
- Failing: 0
- Expectations: 181
- Test Duration: ~9ms
```

## License

MIT
