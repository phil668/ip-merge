#!/usr/bin/env node

import { processCIDRStrings } from './index.js'

function main() {
  // 从命令行参数或标准输入读取
  const args = process.argv.slice(2)

  let input: string

  if (args.length > 0) {
    // 从命令行参数读取
    input = args.join(' ')
  }
  else {
    // 从标准输入读取
    const chunks: Buffer[] = []
    process.stdin.on('data', (chunk) => {
      chunks.push(chunk)
    })
    process.stdin.on('end', () => {
      input = Buffer.concat(chunks).toString('utf-8')
      processInput(input)
    })
    return
  }

  processInput(input)
}

function processInput(input: string) {
  try {
    const result = processCIDRStrings(input)
    // 输出结果，每行一个
    console.log(result.join(' '))
  }
  catch (error) {
    console.error('Error processing CIDR strings:', error)
    process.exit(1)
  }
}

main()
