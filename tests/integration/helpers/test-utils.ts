/**
 * 生成唯一的测试用 IP 地址，用于绕过 @nestjs/throttler 的速率限制。
 * 每个测试文件应使用不同的网段前缀以避免冲突。
 */
export function createIpGenerator(segment: number) {
  let counter = 1
  return function nextIp(): string {
    return `192.168.${segment}.${counter++}`
  }
}
