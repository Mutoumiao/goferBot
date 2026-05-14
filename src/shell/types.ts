export type Unlisten = () => void

export interface Shell {
  /** 获取当前 Sidecar HTTP 端口，未就绪时返回 null */
  getSidecarPort(): Promise<number | null>

  /** 监听 sidecar-ready 事件 */
  onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten>

  /** 监听 sidecar-restarted 事件 */
  onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten>

  /** 请求重启 Sidecar */
  restartSidecar(): Promise<void>

  /** 打开文件对话框并导入到指定知识库路径 */
  importFiles(knowledgeBaseId: string, targetPath: string): Promise<void>
}
