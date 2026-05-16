import type { IRepository } from '../interfaces/IRepository.js';
import type {
  UserSelect,
  KnowledgeBaseSelect,
  FolderSelect,
  DocumentSelect,
  ChunkSelect,
  SessionSelect,
  MessageSelect,
} from './schema.js';

// 编译时验证：所有 Select 类型均满足 IRepository<T> 的 T extends { id: string } 约束
const _userRepo: IRepository<UserSelect> = {} as any;
const _kbRepo: IRepository<KnowledgeBaseSelect> = {} as any;
const _folderRepo: IRepository<FolderSelect> = {} as any;
const _docRepo: IRepository<DocumentSelect> = {} as any;
const _chunkRepo: IRepository<ChunkSelect> = {} as any;
const _sessionRepo: IRepository<SessionSelect> = {} as any;
const _messageRepo: IRepository<MessageSelect> = {} as any;

// 抑制未使用变量警告
void _userRepo;
void _kbRepo;
void _folderRepo;
void _docRepo;
void _chunkRepo;
void _sessionRepo;
void _messageRepo;
