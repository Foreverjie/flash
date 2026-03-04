/**
 * Snowflake-compatible ID generator.
 *
 * The client SDK validates IDs with `isBizId()` which expects a 13-19 digit
 * numeric string encoding a timestamp (relative to epoch 1712546615000) in the
 * high bits. This generator produces IDs that pass that check.
 */

const EPOCH = 1712546615000n
let sequence = 0n

export function generateSnowflakeId(): string {
  const timestamp = BigInt(Date.now()) - EPOCH
  // 41 bits timestamp | 12 bits random | 10 bits sequence
  sequence = (sequence + 1n) & 0x3ffn // 10-bit sequence wraps at 1024
  const random = BigInt(Math.floor(Math.random() * 4096)) // 12-bit random
  const id = (timestamp << 22n) | (random << 10n) | sequence
  return id.toString()
}
