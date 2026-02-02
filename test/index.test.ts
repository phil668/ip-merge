import { describe, expect, it } from 'vitest'
import {
  canMerge,
  cidrToString,
  deduplicateCIDRs,
  mergeCIDR,
  mergeCIDRs,
  normalizeCIDR,
  parseCIDR,
  processCIDRStrings,
} from '../src/index'

describe('parseCIDR', () => {
  it('should parse valid CIDR', () => {
    const result = parseCIDR('192.168.0.0/24')
    expect(result).toEqual({ ip: 0xC0A80000, prefix: 24 })
  })

  it('should return null for invalid CIDR', () => {
    expect(parseCIDR('invalid')).toBeNull()
    expect(parseCIDR('192.168.0.0')).toBeNull()
    expect(parseCIDR('192.168.0.0/33')).toBeNull()
    expect(parseCIDR('256.0.0.0/24')).toBeNull()
  })
})

describe('cidrToString', () => {
  it('should convert CIDR to string', () => {
    const cidr = { ip: 0xC0A80000, prefix: 24 }
    expect(cidrToString(cidr)).toBe('192.168.0.0/24')
  })
})

describe('normalizeCIDR', () => {
  it('should normalize CIDR to network address', () => {
    const cidr = { ip: 0xC0A80005, prefix: 24 } // 192.168.0.5/24
    const normalized = normalizeCIDR(cidr)
    expect(normalized.ip).toBe(0xC0A80000) // 192.168.0.0
    expect(normalized.prefix).toBe(24)
  })
})

describe('canMerge', () => {
  it('should detect mergeable CIDRs', () => {
    const a = parseCIDR('192.168.0.0/25')!
    const b = parseCIDR('192.168.0.128/25')!
    expect(canMerge(a, b)).toBe(true)
  })

  it('should detect non-mergeable CIDRs with different prefixes', () => {
    const a = parseCIDR('192.168.0.0/24')!
    const b = parseCIDR('192.168.0.0/25')!
    expect(canMerge(a, b)).toBe(false)
  })

  it('should detect non-mergeable CIDRs that are not adjacent', () => {
    const a = parseCIDR('192.168.0.0/24')!
    const b = parseCIDR('192.168.2.0/24')!
    expect(canMerge(a, b)).toBe(false)
  })
})

describe('mergeCIDR', () => {
  it('should merge two CIDRs', () => {
    const a = parseCIDR('192.168.0.0/25')!
    const b = parseCIDR('192.168.0.128/25')!
    const merged = mergeCIDR(a, b)
    expect(cidrToString(merged)).toBe('192.168.0.0/24')
  })
})

describe('deduplicateCIDRs', () => {
  it('should remove duplicates', () => {
    const cidrs = [
      parseCIDR('192.168.0.0/24')!,
      parseCIDR('192.168.0.5/24')!, // 会被规范化成 192.168.0.0/24
      parseCIDR('192.168.0.0/24')!,
    ]
    const deduplicated = deduplicateCIDRs(cidrs)
    expect(deduplicated.length).toBe(1)
    expect(cidrToString(deduplicated[0])).toBe('192.168.0.0/24')
  })
})

describe('mergeCIDRs', () => {
  it('should merge mergeable CIDRs', () => {
    const cidrs = [
      parseCIDR('192.168.0.0/25')!,
      parseCIDR('192.168.0.128/25')!,
    ]
    const merged = mergeCIDRs(cidrs)
    expect(merged.length).toBe(1)
    expect(cidrToString(merged[0])).toBe('192.168.0.0/24')
  })

  it('should merge multiple levels', () => {
    const cidrs = [
      parseCIDR('192.168.0.0/26')!,
      parseCIDR('192.168.0.64/26')!,
      parseCIDR('192.168.0.128/26')!,
      parseCIDR('192.168.0.192/26')!,
    ]
    const merged = mergeCIDRs(cidrs)
    expect(merged.length).toBe(1)
    expect(cidrToString(merged[0])).toBe('192.168.0.0/24')
  })

  it('should not merge non-mergeable CIDRs', () => {
    const cidrs = [
      parseCIDR('192.168.0.0/24')!,
      parseCIDR('192.168.2.0/24')!,
    ]
    const merged = mergeCIDRs(cidrs)
    expect(merged.length).toBe(2)
  })
})

describe('processCIDRStrings', () => {
  it('should process and merge CIDR strings', () => {
    const input = '192.168.0.0/25 192.168.0.128/25 10.0.0.0/24'
    const result = processCIDRStrings(input)
    expect(result).toContain('192.168.0.0/24')
    expect(result).toContain('10.0.0.0/24')
    expect(result.length).toBe(2)
  })

  it('should deduplicate and merge', () => {
    const input = '192.168.0.0/25 192.168.0.128/25 192.168.0.0/25'
    const result = processCIDRStrings(input)
    expect(result).toEqual(['192.168.0.0/24'])
  })

  it('should handle empty input', () => {
    const result = processCIDRStrings('')
    expect(result).toEqual([])
  })

  it('should ignore invalid CIDRs', () => {
    const input = '192.168.0.0/25 invalid 192.168.0.128/25'
    const result = processCIDRStrings(input)
    expect(result).toEqual(['192.168.0.0/24'])
  })
})
