import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module.js'
import { bootstrap } from './bootstrap.js'

async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1048576 }), // 1MB JSON body limit
  )

  await bootstrap(app)

  // Swagger/OpenAPI 文档（仅开发环境）
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('GoferBot API')
      .setDescription('GoferBot 云端 AI Workspace API 文档')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
  await app.listen(port, '0.0.0.0')

  console.log(`Server running on http://localhost:${port}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`API Docs: http://localhost:${port}/api/docs`)
  }
}

main()
