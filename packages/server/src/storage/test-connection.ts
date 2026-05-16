import { MinIOStorageProvider } from './minio.js'
import { getStorageConfig } from '../config/storage.js'

async function main() {
  const config = getStorageConfig()
  const storage = new MinIOStorageProvider(config)

  console.log('[test] 初始化 MinIOStorageProvider...')
  await storage.initialize()
  console.log('[test] bucket 检查/创建完成')

  const testKey = 'users/00000000-0000-0000-0000-000000000000/kb/00000000-0000-0000-0000-000000000001/doc-test_hello.txt'
  const testContent = 'Hello from GoferBot MinIO test!'
  const testBuffer = Buffer.from(testContent, 'utf-8')

  // 上传：将 Buffer 包装为 ReadableStream
  console.log('[test] 上传测试文件...')
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(testBuffer))
      controller.close()
    },
  })
  const meta = await storage.upload(testKey, webStream, 'text/plain')
  console.log('[test] 上传成功:', meta)

  // 获取 URL
  console.log('[test] 获取文件 URL...')
  const url = await storage.getUrl(testKey)
  console.log('[test] URL:', url)

  // 下载
  console.log('[test] 下载测试文件...')
  const downloadStream = await storage.download(testKey)
  const reader = downloadStream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const downloaded = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf-8')
  console.log('[test] 下载内容:', downloaded)

  if (downloaded !== testContent) {
    throw new Error('下载内容不匹配')
  }

  // 删除
  console.log('[test] 删除测试文件...')
  await storage.delete(testKey)
  console.log('[test] 删除成功')

  // 幂等删除验证（再次删除不应抛错）
  console.log('[test] 再次删除同一 key（验证幂等）...')
  await storage.delete(testKey)
  console.log('[test] 幂等删除通过')

  console.log('[test] 全部验证通过')
}

main().catch(err => {
  console.error('[test] 验证失败:', err)
  process.exit(1)
})
