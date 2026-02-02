import { mergeCidr, normalizeCidr, parseCidr } from 'cidr-tools'

/**
 * IP网段（CIDR）表示
 */
export interface CIDR {
  /** IP地址的32位整数表示 */
  ip: number
  /** 前缀长度（0-32） */
  prefix: number
}

/**
 * 验证IPv4地址是否有效（每个字节在0-255范围内）
 */
function isValidIPv4(ipNum: number): boolean {
  // 检查是否在有效范围内
  if (ipNum < 0 || ipNum > 0xFFFFFFFF)
    return false

  // 检查每个字节是否在0-255范围内
  const bytes = [
    (ipNum >>> 24) & 0xFF,
    (ipNum >>> 16) & 0xFF,
    (ipNum >>> 8) & 0xFF,
    ipNum & 0xFF,
  ]

  return bytes.every(byte => byte >= 0 && byte <= 255)
}

/**
 * 将字符串格式的CIDR转换为CIDR对象（仅支持IPv4）
 */
function stringToCIDR(cidrStr: string): CIDR | null {
  try {
    const parsed = parseCidr(cidrStr)
    // 只支持IPv4
    if (parsed.version !== 4)
      return null

    // 从BigInt转换为number（IPv4地址可以用number表示）
    const ipNum = Number(parsed.start)

    // 验证IP地址是否有效
    if (!isValidIPv4(ipNum))
      return null

    const prefix = Number.parseInt(parsed.prefix, 10)
    if (Number.isNaN(prefix) || prefix < 0 || prefix > 32)
      return null

    return { ip: ipNum, prefix }
  }
  catch {
    return null
  }
}

/**
 * 将CIDR对象转换为字符串格式
 */
function cidrToStringInternal(cidr: CIDR): string {
  const parts: number[] = []
  let ip = cidr.ip
  for (let i = 0; i < 4; i++) {
    parts.unshift(ip & 0xFF)
    ip >>>= 8
  }
  return `${parts.join('.')}/${cidr.prefix}`
}

/**
 * 验证IP地址字符串是否有效
 */
function isValidIPString(ipStr: string): boolean {
  const parts = ipStr.split('.')
  if (parts.length !== 4)
    return false

  for (const part of parts) {
    const num = Number.parseInt(part, 10)
    if (Number.isNaN(num) || num < 0 || num > 255)
      return false
  }

  return true
}

/**
 * 解析CIDR字符串为CIDR对象
 * @param cidr CIDR字符串，如 "192.168.0.0/24"
 * @returns CIDR对象，如果解析失败返回null
 */
export function parseCIDR(cidr: string): CIDR | null {
  // 必须包含 '/' 分隔符
  if (!cidr.includes('/'))
    return null

  // 验证IP地址部分
  const [ipStr] = cidr.split('/')
  if (!isValidIPString(ipStr))
    return null

  return stringToCIDR(cidr)
}

/**
 * 将CIDR对象转换为字符串
 */
export function cidrToString(cidr: CIDR): string {
  return cidrToStringInternal(cidr)
}

/**
 * 规范化CIDR：确保IP地址是网络地址
 */
export function normalizeCIDR(cidr: CIDR): CIDR {
  const cidrStr = cidrToStringInternal(cidr)
  const normalizedStr = normalizeCidr(cidrStr)
  const normalized = stringToCIDR(normalizedStr)
  if (!normalized)
    throw new Error('Failed to normalize CIDR')
  return normalized
}

/**
 * 比较两个CIDR（用于排序）
 * 先按IP地址排序，再按前缀长度排序
 */
export function compareCIDR(a: CIDR, b: CIDR): number {
  if (a.ip !== b.ip)
    return a.ip - b.ip
  return a.prefix - b.prefix
}

/**
 * 检查两个CIDR是否相等
 */
export function cidrEqual(a: CIDR, b: CIDR): boolean {
  return a.ip === b.ip && a.prefix === b.prefix
}

/**
 * 检查两个CIDR是否可以合并
 * 两个相同前缀长度的相邻网段可以合并成一个前缀长度减1的网段
 */
export function canMerge(a: CIDR, b: CIDR): boolean {
  // 前缀长度必须相同
  if (a.prefix !== b.prefix)
    return false

  // 前缀长度不能为0（无法合并）
  if (a.prefix === 0)
    return false

  // 使用 cidr-tools 的 mergeCidr 来检查是否可以合并
  const aStr = cidrToStringInternal(a)
  const bStr = cidrToStringInternal(b)
  const merged = mergeCidr([aStr, bStr])

  // 如果可以合并，结果应该只有一个CIDR，且前缀长度减1
  return merged.length === 1 && merged[0].endsWith(`/${a.prefix - 1}`)
}

/**
 * 合并两个CIDR
 * 前提：canMerge(a, b) 必须返回 true
 */
export function mergeCIDR(a: CIDR, b: CIDR): CIDR {
  if (!canMerge(a, b))
    throw new Error('Cannot merge these CIDRs')

  const aStr = cidrToStringInternal(a)
  const bStr = cidrToStringInternal(b)
  const merged = mergeCidr([aStr, bStr])

  if (merged.length !== 1)
    throw new Error('Failed to merge CIDRs')

  const result = stringToCIDR(merged[0])
  if (!result)
    throw new Error('Failed to parse merged CIDR')

  return result
}

/**
 * 去重CIDR列表
 */
export function deduplicateCIDRs(cidrs: CIDR[]): CIDR[] {
  const seen = new Set<string>()
  const result: CIDR[] = []

  for (const cidr of cidrs) {
    const normalized = normalizeCIDR(cidr)
    const key = `${normalized.ip}/${normalized.prefix}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(normalized)
    }
  }

  return result
}

/**
 * 合并CIDR列表
 * 递归合并所有可以合并的网段
 */
export function mergeCIDRs(cidrs: CIDR[]): CIDR[] {
  // 先规范化并去重
  const normalized = deduplicateCIDRs(cidrs)

  // 转换为字符串数组
  const cidrStrings = normalized.map(cidrToStringInternal)

  // 使用 cidr-tools 的 mergeCidr 进行合并
  const mergedStrings = mergeCidr(cidrStrings)

  // 转换回CIDR对象数组
  const result: CIDR[] = []
  for (const cidrStr of mergedStrings) {
    const cidr = stringToCIDR(cidrStr)
    if (cidr)
      result.push(cidr)
  }

  // 排序
  result.sort(compareCIDR)

  return result
}

/**
 * 解析并处理CIDR字符串列表
 */
export function processCIDRStrings(input: string): string[] {
  // 按空格分割
  const parts = input.trim().split(/\s+/)
  const validCidrs: string[] = []

  // 过滤出有效的CIDR字符串（仅IPv4）
  for (const part of parts) {
    if (!part)
      continue
    try {
      const parsed = parseCidr(part)
      // 只处理IPv4
      if (parsed.version === 4)
        validCidrs.push(part)
    }
    catch {
      // 忽略无效的CIDR
    }
  }

  // 使用 cidr-tools 的 mergeCidr 进行合并
  if (validCidrs.length === 0)
    return []

  const merged = mergeCidr(validCidrs)

  // 排序（IPv4在前，已经是排序的）
  return merged.sort()
}
